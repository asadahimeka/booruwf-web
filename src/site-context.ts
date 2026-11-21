import { getNavDomains } from './api/sites'

/**
 * 「当前站点上下文」—— 用户脚本版大量代码以 `location.host` 为前提，
 * web 版统一从这里取值（由 ?site= / ?path= 查询参数驱动）。
 *
 * 迁移适配器时的替换规则（详见 docs/migration-plan.md 3.2 节）：
 * - `location.host` / `location.hostname` → `siteContext.host`
 * - `location.origin` 拼接 API URL         → `siteContext.origin`
 * - `location.pathname`（区分页面形态）    → `siteContext.pathname`（来自 ?path=）
 *   注意：?path= 的值可能自带查询串（如 gelbooru 的 index.php?page=post&s=list、
 *   wallhaven 的 /search?q=xxx），构造链接时必须对值整体 encodeURIComponent，
 *   否则会被拆成独立的顶层查询参数。
 * - `document.cookie` / CSRF / 登录态      → 不迁移（登录态功能不做）
 */

export interface SiteContext {
  /** 当前站点域名，如 'yande.re'（未指定或非法时回落 yande.re） */
  host: string
  /** 拼接上游 URL 用，如 'https://yande.re' */
  origin: string
  /** 页面形态路径（沿用 pool/popular 的 ?path= 约定），可能自带查询串 */
  pathname: string
  /**
   * 等价于脚本版的 `location.pathname`：`?path=` 剥掉 `?...` / `#...` 后的纯路径。
   *
   * 形态判定（`SOME_PATH_RE.test(...)`）与路径解析必须用它 —— `pathname` 是
   * `?path=` 的原值，`/ja/photos?text=Ao` 会让带 `$` 锚点的正则整条落空，
   * 而 `location.pathname` 本身从不包含查询串。拼接上游 URL 时仍用 `pathname`。
   */
  pathOnly: string
  /** 是否 moebooru 系（yande.re / konachan / sakugabooru / lolibooru） */
  isYKSite: boolean
}

const DEFAULT_HOST = 'yande.re'

/** 至少含一个点的语法合法域名（用于拦截明显误输入，如 ?site=foo） */
const HOSTNAME_RE = /^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/i

function resolveHost(): string {
  const site = new URLSearchParams(location.search).get('site')
  if (!site) return DEFAULT_HOST
  // 除导航站列表外，同时接受语法合法的任意域名 —— szurubooru 演示站与
  // 用户在设置里配置的自定义 szuru 域不在导航列表里（store 依赖本模块，
  // 无法反向引入 settings 校验）。真正的访问边界由服务端域名白名单把守。
  return getNavDomains().includes(site) || HOSTNAME_RE.test(site) ? site : DEFAULT_HOST
}

export const siteContext: SiteContext = {
  host: resolveHost(),
  get origin() {
    return `https://${this.host}`
  },
  get pathname() {
    return new URLSearchParams(location.search).get('path') || ''
  },
  get pathOnly() {
    // 未带 ?path= 时等价于站点首页 `/`（脚本版的 location.pathname 永远至少是 `/`），
    // 不能返回空串：`^/(?:…)?$` 这类列表路径正则会整条落空，把默认首页判成「不接管」
    return this.pathname.split(/[?#]/)[0] || '/'
  },
  get isYKSite() {
    return ['konachan', 'yande.re'].some(e => this.host.includes(e))
  },
}

/** 浅拷贝一份 context 供适配器临时切换站点（如 szurubooru 多站配置） */
export function withSite(host: string): SiteContext {
  return {
    host,
    origin: `https://${host}`,
    pathname: siteContext.pathname,
    pathOnly: siteContext.pathname.split(/[?#]/)[0] || '/',
    isYKSite: ['konachan', 'yande.re'].some(e => host.includes(e)),
  }
}
