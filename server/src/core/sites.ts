/**
 * 站点白名单 + per-site 规则表。
 *
 * 白名单由 packages/booru/sites.json 的域名派生（见 scripts/generate-allowed-domains.mjs），
 * 外加手工维护的例外项。规则表按「注册表风格」组织：键是域名字符串或正则，
 * 命中的条目决定 /proxy /img /dl 对上游请求的 header 伪装策略。
 *
 * 三运行时兼容：本文件为纯数据 + 纯函数，不依赖任何运行时专属 API。
 */
import { booruSiteDomains } from './allowed-domains.ts'

/**
 * 手工维护的例外域名（booru 包 sites.json 未收录、但脚本版适配器硬编码使用的站点）。
 * 只登记裸域：isAllowedDomain 用后缀匹配，www./img. 等子域自动覆盖。
 * 来源：脚本版 src/api/*.ts 中全部硬编码 host。
 */
const extraDomains = [
  // sankaku 系
  'sankaku.app',
  'sankakucomplex.com',
  'sankakuapi.com',
  'idolcomplex.com', // idolcomplex.com 裸域（www. 形式在适配器中使用）
  // WordPress 图床（i3.wp.com 等，16k/misskon 引用）
  'wp.com',
  // danbooru 图床
  'donmai.us',
  // booru.org 二级站（allgirl 等）
  'booru.org',
  // 图/壁纸站
  'zerochan.net',
  'wallhaven.cc',
  'nozomi.la',
  'e-shuushuu.net',
  'anime-pictures.net',
  'booru.eu',
  'gsbooru.org',
  'kusowanka.com',
  'uhdpaper.com',
  'anihonetwallpaper.com',
  // 汉化/壁纸采集站
  'wnacg.com',
  'nanairo.co',
  'dimtown.com',
  'dimapi.com',
  'misskon.com',
  'shaonvzhi.top',
  '16knote.com',
  '16k.club',
  'huamaobizhi.com',
  'everia.club',
  'galleryepic.com',
  'static.galleryepic.xyz',
  'hentaiclub.net',
  'hentaigamecg.com',
  'hentai-cosplay-xxx.com',
  // kin8/everia 系图床
  'gold-usergeneratedcontent.net',
  // 其它
  'rule34.xxx', // 裸域（sites.json 只登记了 api.rule34.xxx）
  'rule34hentai.net',
  'funmaker.moe',
  'cin.wtf',
  'same.yui.pw',
  'nekomaru.moe',
  'pximg.net', // pixiv 图源（若日后接入）
  'fbcdn.net',
  'karubox.top',
  'airibox.top',
  'fujibox.top',
  'paheal.net',
  'sshs.rip',
  'huamaocdn.com',
  'kontol.online',
  'townimg.com',
  'qy0.ru',
]

export const allowedDomains = [...new Set([...booruSiteDomains, ...extraDomains])]

export interface SiteRule {
  /** 上游请求使用的 User-Agent */
  ua?: string
  /** 上游请求伪装的 Referer（或 'self' 表示上游站点自身 origin） */
  referer?: string | 'self'
  /** 附加请求头 */
  headers?: Record<string, string>
  /** 是否跟随重定向（默认 true） */
  redirect?: 'follow' | 'manual'
}

export const DESKTOP_UA
  = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

/** e621 的 API 政策要求 UA 报明项目身份（泛浏览器 UA / curl 默认 UA 都会被 403） */
export const PROJECT_UA = 'booruwf/0.39 (booruwf web masonry client)'

/**
 * 站点级上游请求策略（UA 政策 / 防盗链 Referer / 必需请求头）。
 *
 * 命中的条目覆盖默认的 `DESKTOP_UA`。这里的 UA 选择不是「伪装得越像浏览器越好」：
 * Cloudflare 的 bot management 会对比 UA 与 TLS 指纹、sec-ch-ua 等客户端提示，
 * 一个声称 Chrome 131 但没有对应指纹的请求会被直接判为自动化并下发 403 挑战页；
 * 反过来，明确报明身份的 UA 走的是「已知 bot」通道，通常直接放行。
 */
const siteRules: [RegExp, SiteRule][] = [
  // e621/e926：应用层 UA 政策（TLS 层的指纹封锁由 curl 回退处理）
  [/(^|\.)(e621|e926)\.net$/, { ua: PROJECT_UA }],
  // danbooru 系（含 cdn.donmai.us 图床）：同上，Chrome UA 会被 CF 挑战。
  // 实测 /posts.json 与 cdn 原图在 DESKTOP_UA 下恒 403（Just a moment...），
  // 换 PROJECT_UA 后同一 URL 均 200。danbooru 官方 API 政策本就要求报明项目身份。
  [/(^|\.)donmai\.us$/, { ua: PROJECT_UA }],
  // pixiv 系
  [/(^|\.)pximg\.net$/, { referer: 'https://www.pixiv.net/' }],
  // konachan/yande 图床对空 Referer 不拦，但保险起见统一伪装
  [/(^|\.)(yande\.re|konachan\.(com|net))$/, { referer: 'self' }],
  // gelbooru 系图床：无 Referer 时 302 → hotlink.php（跳回站点首页 HTML）
  [/(^|\.)gelbooru\.com$/, { referer: 'https://gelbooru.com/' }],
  // realbooru：缩略图/图床无 Referer 时 302 跳转（实测带 self referer 200）
  [/(^|\.)realbooru\.com$/, { referer: 'self' }],
  // rule34.xxx 图床同理
  [/(^|\.)rule34\.xxx$/, { referer: 'https://rule34.xxx/' }],
  // dimtown 的数据接口校验 Origin（只放行 dimtown.com 来源）
  [/(^|\.)dimapi\.com$/, {
    referer: 'https://dimtown.com/',
    headers: { origin: 'https://dimtown.com' },
  }],
  // sankaku 系 API：要求 api-version/client-type/platform 请求头
  // （前端 apiFetch 传的自定义头 /proxy 不透传，统一在规则表声明）
  [/(^|\.)sankakuapi\.com$/, {
    headers: {
      'api-version': '2',
      'client-type': 'non-premium',
      'platform': 'web-app',
    },
  }],
  // nozomi 系图床：必须带 nozomi.la 的 Referer，否则一律 404（实测）
  [/(^|\.)gold-usergeneratedcontent\.net$/, { referer: 'https://nozomi.la/' }],
  // cin.wtf（hitomi 系镜像）图床：校验的是 Origin 头而非 Referer，
  // 必须带 origin: https://cin.wtf 否则 403 Forbidden（实测 referer 无效）
  [/(^|\.)kontol\.online$/, { headers: { origin: 'https://cin.wtf' } }],
]

/** 按目标 URL 解析规则；未命中返回默认规则 */
export function resolveRule(url: URL): SiteRule {
  const host = url.hostname
  for (const [re, rule] of siteRules) {
    if (re.test(host)) {
      return {
        ua: DESKTOP_UA,
        ...rule,
        referer: rule.referer === 'self' ? `${url.origin}/` : rule.referer,
      }
    }
  }
  return { ua: DESKTOP_UA }
}

/** /img 是否放开到任意 https 域（默认开；环境变量 IMG_ALLOW_ANY_HOST=0 关闭回到纯白名单） */
const allowAnyImageHost = process.env.IMG_ALLOW_ANY_HOST !== '0'

/** 至少两段、非内网/回环的域名（拦截 localhost / *.local / IP 直连类 SSRF 目标） */
const PUBLIC_HOST_RE = /^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/i

/** 严格白名单（/proxy 与 /dl 用）：只放行登记过的站点与图床域 */
export function isAllowedDomain(url: URL): boolean {
  const host = url.hostname
  return allowedDomains.some(domain =>
    host === domain || host.endsWith(`.${domain}`),
  )
}

/**
 * 图片端点的放行判定（/img 用）。
 *
 * 图床域名经常整批更换（kontol/airibox/fujibox…），静态白名单必然滞后。
 * /img 的目标 URL 都来自「已放行站点页面里解析出的图片地址」，风险面
 * （SSRF）主要在 /proxy 的任意 HTML 抓取而不是图片字节转发，因此图片
 * 域名在白名单之外额外放开到「语法合法的公网 https 域」。
 * 环境变量 IMG_ALLOW_ANY_HOST=0 可关闭，回到纯白名单模式。
 */
export function isAllowedImageDomain(url: URL): boolean {
  if (isAllowedDomain(url)) return true
  return allowAnyImageHost && url.protocol === 'https:' && PUBLIC_HOST_RE.test(url.hostname)
}
