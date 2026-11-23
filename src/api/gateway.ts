/**
 * 统一请求网关 —— 用户脚本版适配器里的 `fetch(...)` 在 web 版一律改走这里。
 *
 * - 数据请求（API JSON / HTML 页面）→ 服务端 `GET /proxy?url=`（按站点规则伪装 header）
 * - `settings.apiProxy` 配了第三方前缀代理时，改走 `${apiProxy}${url}`（web 原版
 *   src/plugins/fetch.ts 的行为）；第三方代理做不了 Referer 伪装与挑战应答，
 *   需要这些能力的站点（gelbooru/zerochan/dimtown…）应保持默认内置服务端
 * - 替换原 `src/plugins/fetch.ts` 的 window.fetch 全局 patch：
 *   patch 会误伤图片加载与第三方请求，且无法按站点写规则，M1 迁移完成后删除该 patch
 *
 * 服务端地址默认同源（Hono 托管前端产物），可用 localStorage `__apiServer` 覆盖
 * （例：前端单独部署到 Vercel 而服务端跑在本机时）。
 */

import { settings } from '@/store'
import { siteContext } from '@/site-context'

const serverKey = '__apiServer'

function serverBase(): string {
  const custom = localStorage.getItem(serverKey)
  return custom ? custom.replace(/\/$/, '') : ''
}

// 兼容用户粘贴 "https://xxx/" 或裸域名
export function normalizeSzuruDomain(input: string) {
  const value = (input || '').trim()
  if (!value) return ''
  try {
    return new URL(value.includes('://') ? value : `https://${value}`).host
  } catch {
    return ''
  }
}

/**
 * 目标 host 是用户配置的自部署 szurubooru 域时，随代理请求以 `claim` 参数
 * 声明该域：自定义域不在服务端内置白名单里，服务端校验「声明域 == 目标域」
 * 且为公网 https 后放行（/proxy /dl /img）。第三方前缀代理走不到这套机制。
 */
function szuruClaimParam(target: string): string {
  const configs = settings.szurubooruConfigs
  if (!configs?.length) return ''
  let host = ''
  try {
    host = new URL(target).hostname.toLowerCase()
  } catch {
    return ''
  }
  const hit = configs.some(c => normalizeSzuruDomain(c.domain).toLowerCase() === host)
  return hit ? `&claim=${encodeURIComponent(host)}` : ''
}

/**
 * 把上游 URL 重写为 API 代理地址：内置服务端 /proxy 或第三方前缀代理。
 *
 * 导出给 main.ts 的 BOORU_FETCH_PROXY 钩子复用——@himeka/booru 包内的 search()
 * 不走 apiFetch，必须让两条管线共用同一套代理解析，否则切换 apiProxy 后包站
 * 仍打默认 /proxy（每次调用都读 settings，故设置变更即时生效）。
 */
export function toApiProxyUrl(target: string): string {
  const proxy = settings.apiProxy
  if (proxy && proxy !== '__server') return proxy + target
  return `${serverBase()}/proxy?url=${encodeURIComponent(target)}${szuruClaimParam(target)}`
}

export function setApiServer(base: string) {
  base ? localStorage.setItem(serverKey, base.replace(/\/$/, '')) : localStorage.removeItem(serverKey)
}

export interface ApiFetchOptions extends RequestInit {
  /** 期望的响应类型，默认 text（JSON 解析交给调用方） */
  as?: 'text' | 'arrayBuffer'
  /** 容忍非 2xx 状态码（zerochan 的 JSON 接口会返回 500 + 合法 body 这类怪癖） */
  tolerant?: boolean
}

export async function apiFetch(input: string | URL, options?: ApiFetchOptions & { as?: 'text' }): Promise<string>
export async function apiFetch(input: string | URL, options: ApiFetchOptions & { as: 'arrayBuffer' }): Promise<ArrayBuffer>
export async function apiFetch(input: string | URL, options: ApiFetchOptions = {}): Promise<string | ArrayBuffer> {
  const { as = 'text', tolerant, ...init } = options
  const target = input.toString()
  const proxied = toApiProxyUrl(target)
  const headers = new Headers(init.headers || {})
  const accept = target.includes('.json') || target.includes('api')
    ? 'application/json, text/*;q=0.8'
    : 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
  if (!headers.has('accept')) headers.set('accept', accept)

  const res = await fetch(proxied, { ...init, headers })
  if (!tolerant && !res.ok) throw new Error(`apiFetch ${res.status} ${res.statusText}: ${target}`)
  return as === 'arrayBuffer' ? res.arrayBuffer() : res.text()
}

/**
 * 解析上游 HTML 并注入 `<base href>`。
 *
 * 关键坑：DOMParser 产物文档的基准 URL 继承自**创建文档**（localhost SPA），
 * 所有 reflected URL 属性（`a.href` / `img.src`）都会把站点 HTML 里的相对地址
 * 解析成 localhost 地址 —— kusowanka 的 `/post/13603114/` 会变成
 * `http://127.0.0.1:8806/post/...`，`match(/(\d+)/)` 拿到的 id 永远是 127，
 * uniqBy('id') 把整页 54 条坍缩成 1 条。注入 `<base>` 后 reflected 属性
 * 按目标站点解析，与脚本版跑在站点域名上的行为一致。
 *
 * base 缺省用当前站点 origin；解析目标与站点域不同时必须显式传入实际抓取的 URL。
 */
export function parseHTML(html: string, base = siteContext.origin): Document {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  if (base) {
    const el = doc.createElement('base')
    el.href = base
    doc.head.appendChild(el)
  }
  return doc
}

/** 便捷封装：JSON 响应 */
export async function apiFetchJson<T = any>(input: string | URL, options: ApiFetchOptions = {}) {
  const text = (await apiFetch(input, { ...options, as: 'text' })) as string
  return JSON.parse(text) as T
}

/** 把站点图片/视频 URL 重写为服务端图片代理地址（防盗链伪装在服务端规则表里） */
export function toProxyImgUrl(url: string | null | undefined) {
  // claim：IMG_ALLOW_ANY_HOST=0（纯白名单模式）时放行用户配置的自定义站点域
  return url ? `${serverBase()}/img?url=${encodeURIComponent(url)}${szuruClaimParam(url)}` : url
}

/** 把下载 URL 重写为服务端下载代理地址（Content-Disposition 附件） */
export function toProxyDlUrl(url: string, name?: string) {
  const nameQ = name ? `&name=${encodeURIComponent(name)}` : ''
  return `${serverBase()}/dl?url=${encodeURIComponent(url)}${nameQ}${szuruClaimParam(url)}`
}
