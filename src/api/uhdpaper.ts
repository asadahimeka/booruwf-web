import { apiFetch, parseHTML } from './gateway'
import { siteContext } from '@/site-context'

const ORIGIN = 'https://www.uhdpaper.com'

export function isUhdpaperPage() {
  return siteContext.host === 'uhdpaper.com' || siteContext.host.endsWith('.uhdpaper.com')
}

// uhdpaper 的列表页没有 page 参数，翻页靠 ?updated-max=... 游标，这里自己记住下一页地址
let nextPageHref: string | null = null
let seenIds = new Set<string>()
let started = false
// 列表页只能拿到按逗号拆散的词，真正的标签（短语）要回详情页取
const postHrefById = new Map<string, string>()

// 站点自己的搜索地址：空格用 + 连接，并带上 i=0
export function uhdpaperSearchUrl(tags: string) {
  const q = tags.trim().split(/\s+/).map(encodeURIComponent).join('+')
  return `${ORIGIN}/search?q=${q}&by-date=true&i=0`
}

// 缩略图地址去掉 -thumb 后缀就是原图地址，服务端会 301 到实际文件
function thumbToOriginal(url: string) {
  return url.split(/[?#]/)[0].replace(/-thumb\.(jpe?g|png|webp)$/i, '')
}

async function parseCard(el: Element) {
  const a = el.querySelector<HTMLAnchorElement>('a[href]')
  const img = el.querySelector<HTMLImageElement>('img[src]')
  if (!a || !img) return null

  // a.href 是 reflected 属性，web 版 DOMParser 文档基准是 localhost，
  // 必须从原生属性拿再用站点域名解析（parseHTML 的 <base> 已兜底 reflected 属性，
  // 这里显式解析是为拿到稳定的绝对地址）
  const postHref = new URL(a.getAttribute('href')!, ORIGIN).href
  const id = postHref.split('/').pop()?.replace(/\.html?$/, '') || ''
  if (!id || seenIds.has(id)) return null

  // 站点把标签放在缩略图外层链接的 aria-label 里，形如 "Anime, Girl, 4K, Wallpaper, #7685t"
  const tags = [...new Set(
    (a.getAttribute('aria-label') || '')
      .split(',')
      .map(tag => tag.trim())
      .filter(tag => tag && !tag.startsWith('#') && !/^wallpaper$/i.test(tag)),
  )]

  const previewUrl = new URL(img.getAttribute('src') || '', ORIGIN).href
  const fileUrl = thumbToOriginal(previewUrl)
  if (!fileUrl) return null

  seenIds.add(id)
  postHrefById.set(id, postHref)

  return {
    id,
    postView: postHref,
    previewUrl,
    // 详情页默认显示 sampleUrl，用站点的 2K 变体，别把缩略图放大糊一屏
    sampleUrl: `${fileUrl}-pc-2k.jpg`,
    fileUrl,
    tags,
    width: 1920,
    height: 1080,
    aspectRatio: 16 / 9,
    fileExt: 'jpg',
    fileDownloadName: `uhdpaper ${id}.jpg`,
    rating: 's',
  } as any
}

export async function fetchUhdpaperPosts(page: number, tags: string | null) {
  if (!started || page <= 1) {
    started = true
    seenIds = new Set()
    // web 版：首页地址由 ?site= + 搜索 tags 决定（脚本版从宿主 location.href 还原）
    nextPageHref = tags ? uhdpaperSearchUrl(tags) : `${ORIGIN}/`
  }
  if (!nextPageHref) return []

  const html = await apiFetch(nextPageHref)
  // parseHTML 注入 <base>：img.src 等 reflected 属性按站点域名解析
  const doc = parseHTML(html, nextPageHref)

  const pager = doc.querySelector<HTMLAnchorElement>('a.blog-pager-older-link')
  nextPageHref = pager?.getAttribute('href') ? new URL(pager.getAttribute('href')!, ORIGIN).href : null

  const cards = [...doc.querySelectorAll('article.post-outer-container')]
  const results = await Promise.all(cards.map(el => parseCard(el)))
  return results.filter(Boolean)
}

// 详情页隐藏块 <div id="post_tmp"> 里放着站点自己的元数据：
// <h2>Anime Girls, Tongue Out, Nun, Tattoo, 4K, #7310j</h2>、<a> 来源、<img> 原图
export async function fetchUhdpaperDetail(id: string) {
  const href = postHrefById.get(id)
  if (!href) return {}
  const html = await apiFetch(href)
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const meta = doc.querySelector('#post_tmp')
  if (!meta) return {}

  const tags = [...new Set(
    (meta.querySelector('h2')?.textContent || '')
      .split(',')
      .map(tag => tag.trim())
      .filter(tag => tag && !tag.startsWith('#') && !/^wallpaper$/i.test(tag)),
  )]
  const source = meta.querySelector('a')?.getAttribute('href') || ''

  return { tags, source }
}

export const uhdpaper = {
  is: isUhdpaperPage,
  posts: fetchUhdpaperPosts,
  detail: fetchUhdpaperDetail,
}
