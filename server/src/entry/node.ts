/**
 * Node 运行时入口。仓库根目录或 server/ 目录启动均可：
 *   pnpm --dir server start    （或根目录 pnpm server:start）
 */
import { relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { PORT, createApp } from '../core/index.ts'
import { DESKTOP_UA } from '../core/sites.ts'
import { setUpstreamFetch } from '../core/runtime.ts'
import { curlFetch } from './curl-fetch.ts'

const distAbs = fileURLToPath(new URL('../../../dist', import.meta.url))
const distRoot = relative(process.cwd(), distAbs).replace(/\\/g, '/') || '.'

// TLS 指纹封锁回退：danbooru / e621 等站的 Cloudflare 对 Node fetch 的 JA3
// 指纹返回 403 challenge（curl 与浏览器的指纹不在封锁名单，实测可通）。
// 命中列表的后缀匹配域名改走 curl 子进程，其余仍走原生 fetch。
// 可用 CURL_FALLBACK_HOSTS 覆盖（逗号分隔；设为空串关闭回退）。
const curlHosts = (process.env.CURL_FALLBACK_HOSTS ?? 'danbooru.donmai.us,aibooru.online,e621.net,e926.net')
  .split(',')
  .map(e => e.trim().toLowerCase())
  .filter(Boolean)

function needsCurlFallback(url: URL) {
  return curlHosts.some(host => url.hostname === host || url.hostname.endsWith(`.${host}`))
}

// 上游代理：danbooru / e621 等站点对部分网络出口直接 403（Cloudflare 拦截），
// 配置 UPSTREAM_PROXY（或标准 HTTPS_PROXY）后所有上游请求走该 HTTP 代理。
// 注意：npm undici 的 setGlobalDispatcher 不影响 Node 内置全局 fetch（独立实例），
// 这里改为把 ProxyAgent 化的 fetch 注入 core（见 core/runtime.ts）。
const upstreamProxy = process.env.UPSTREAM_PROXY ?? process.env.HTTPS_PROXY ?? process.env.HTTP_PROXY
let baseFetch: typeof globalThis.fetch = (input, init) => globalThis.fetch(input as any, init)
if (upstreamProxy) {
  const { fetch: undiciFetch, ProxyAgent } = await import('undici')
  const agent = new ProxyAgent(upstreamProxy)
  baseFetch = ((input: any, init?: any) => undiciFetch(input, { ...init, dispatcher: agent })) as any
  console.log(`[booruwf-server] upstream proxy: ${upstreamProxy}`)
}
if (curlHosts.length) {
  console.log(`[booruwf-server] curl TLS fallback: ${curlHosts.join(', ')}`)
}

// 按域名分流注入：被指纹封锁的域名 → curl 子进程；其余 → 原生 fetch（含 ProxyAgent）
// 注意：curl 回退通道必须剥离伪装的 Chrome UA —— curl 的 TLS 指纹配 Chrome UA
// 属于「指纹与声明不一致」，同样会被 Cloudflare challenge（实测 403）；
// 保留 curl 自己的默认 UA 反而能过（实测 200）
//
// TLS 失败兜底：undici 校验证书时报 "unknown certificate verification error"
// （常见于本机有中间人证书/安全软件注入 CA 的环境，Node 内置根证书不认识），
// curl 走系统证书库通常能过 —— 捕获 UND_ERR / TLS 类错误时自动改走 curl。
setUpstreamFetch((async (input: any, init?: any) => {
  const url = new URL(input.toString())
  if (needsCurlFallback(url)) {
    const headers = new Headers(init?.headers)
    // 只剥离通用桌面 UA（curl 指纹 + Chrome UA 会触发 challenge）；
    // 规则表指定的站点专属 UA（如 e621 的项目 UA）必须保留
    if (headers.get('user-agent') === DESKTOP_UA) headers.delete('user-agent')
    return curlFetch(url, {
      headers,
      method: init?.method,
      body: init?.body,
      redirect: init?.redirect,
    })
  }
  try {
    return await baseFetch(input as any, init)
  } catch (e: any) {
    const code = e?.cause?.code ?? e?.code ?? ''
    const msg = String(e?.cause?.message ?? e?.message ?? '')
    const isTlsError = /CERTIFICATE|TLS|SSL|ECONNRESET/.test(code)
      || /certificate|SSL|TLS/i.test(msg)
    if (isTlsError) {
      const headers = new Headers(init?.headers)
      if (headers.get('user-agent') === DESKTOP_UA) headers.delete('user-agent')
      return curlFetch(url, {
        headers,
        method: init?.method,
        body: init?.body,
        redirect: init?.redirect,
      })
    }
    throw e
  }
}) as any)

const app = createApp({
  serveStatic: opts => serveStatic(opts),
  distRoot,
})

serve({ fetch: app.fetch, port: PORT }, info => {
  console.log(`[booruwf-server] node listening on http://127.0.0.1:${info.port} (dist: ${distRoot})`)
})
