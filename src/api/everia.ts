import type { Post } from '@himeka/booru'
import type { MultiImageAdapter, MultiImageDetail, PostImage, SiteAdapter } from './multi-image'
import { apiFetch } from './gateway'
import { siteContext } from '@/site-context'
import { settings } from '@/store'

const ORIGIN = 'https://everia.club'
const CHUNK_SIZE = 30
const DEFAULT_WIDTH = 1000
const DEFAULT_HEIGHT = 1500

/**
 * 图床域名 → 原图宽度。
 *
 * everia 的图分放在多个图床，图片高度恒为 1500、宽度随图床不同；
 * REST 与 HTML 都不给宽高，`media` 接口又是关闭的（404），
 * 只能按图床规律近似。同一篇文章的图来自同一图床，所以比例一致。
 */
const HOST_WIDTH: Record<string, number> = {
  'karubox.top': 1000,
  'remu.airibox.top': 1060,
  'miya.fujibox.top': 1128,
}

/** 文章页 `/2026/11/16/slug/`，也允许站内分页后缀 `/2/` */
const ARTICLE_PATH = /^\/\d{4}\/\d{2}\/\d{2}\/[^/]+\/(?:\d+\/)?$/

export function isEveria() {
  return siteContext.host === 'everia.club'
}

export function isEveriaArticle() {
  return isEveria() && ARTICLE_PATH.test(siteContext.pathname)
}

export function isEveriaList() {
  return isEveria() && !ARTICLE_PATH.test(siteContext.pathname)
}

function toAbsolute(url: string) {
  try {
    return new URL(url, ORIGIN).href
  } catch {
    return ''
  }
}

function htmlToText(html: string) {
  return new DOMParser().parseFromString(html, 'text/html').body.textContent?.trim() ?? ''
}

function sizeOf(url: string) {
  let width = DEFAULT_WIDTH
  try {
    width = HOST_WIDTH[new URL(url).hostname] ?? DEFAULT_WIDTH
  } catch {
    width = DEFAULT_WIDTH
  }
  return { width, height: DEFAULT_HEIGHT }
}

/* --------------------------------- 分类与预设 -------------------------------- */

interface EveriaCategory {
  /** 展示在候选列表里，也是用户手输时能匹配的名字 */
  label: string
  /** 站点路径里的分类目录名 */
  slug: string
  /** 英文别名，方便手输 japan / cosplay */
  alias: string
}

const CATEGORIES: EveriaCategory[] = [
  { label: '日本', slug: 'japan-gallery', alias: 'japan' },
  { label: '韩国', slug: 'korea-gallery', alias: 'korea' },
  { label: '中国', slug: 'china-gallery', alias: 'china' },
  { label: '角色扮演', slug: 'cosplay-gallery', alias: 'cosplay' },
  { label: '泰国', slug: 'thailand-gallery', alias: 'thailand' },
]

const HOME_ALIASES = ['首页', 'home', 'all']

/**
 * 搜索框里的预设候选，接到 `defCompTags` 那条现成链路上。
 *
 * everia 没有标签体系，搜索框显示的是站内 5 个分类；
 * 点一下等于把这个词填进搜索框，回车后由适配器解析成分类路径。
 */
export const everiaPresetTags = ['首页', ...CATEGORIES.map(e => e.label)]

/**
 * 单个词 → 分类路径，`null` 表示不是分类词。
 */
function categoryPathOf(token: string): string | null {
  const term = token.trim().toLowerCase()
  if (!term) return null
  if (HOME_ALIASES.includes(term)) return '/'
  const hit = CATEGORIES.find(e => term === e.label.toLowerCase() || term === e.slug || term === e.alias)
  return hit ? `/${hit.slug}/` : null
}

/**
 * 把搜索框里的词解析成分类路径，`null` 表示按搜索词处理。
 *
 * 两件事叠在一起：
 * - 分类页会忽略 `?s=`（实测：换成不存在的关键词仍返回同一批 30 条），
 *   所以分类和搜索词无法叠加，这里只认整串都是分类词的情况；
 * - 搜索框选词是"追加"而不是"替换"（`selectTag` 的实现），
 *   连点两个分类会拼成 `日本 首页`，所以整串都是分类词时取最后一个。
 *   一旦掺了别的词（`日本 jvid`），就整体当搜索词，不做猜测。
 */
function resolveCategoryPath(tags?: string | null): string | null {
  const tokens = (tags ?? '').trim().split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return null
  const paths = tokens.map(categoryPathOf)
  if (paths.includes(null)) return null
  return paths[paths.length - 1] ?? null
}

/* ---------------------------------- 列表页 --------------------------------- */

/**
 * 列表页地址。
 *
 * everia 是 WordPress：首页 `/`、分类页 `/japan-gallery/`、搜索 `/?s=xxx`
 * 都靠路径里的 `/page/N/` 翻页，不认 `?p=` 或 `?page=`。
 * 引擎写进 URL 的 `?page=` 必须剥掉，否则会污染站点地址。
 *
 * web 版差异：脚本版无筛选时沿用 `location.href`（用户正在浏览的地址），
 * 这里用 `?path=` 还原；搜索词除了应用自己的 `?tags=`，还要认 `?path=/?s=xxx`
 * 里的站点原生搜索词（脚本版读的是 `location.search` 的 `s`）。
 */
function pathKeyword() {
  const query = siteContext.pathname.split('?')[1] ?? ''
  return new URLSearchParams(query).get('s')?.trim() ?? ''
}

function listUrl(page: number, tags?: string | null) {
  const suffix = page > 1 ? `page/${page}/` : ''

  const categoryPath = resolveCategoryPath(tags)
  if (categoryPath) return `${ORIGIN}${categoryPath}${suffix}`

  const keyword = (tags ?? '').trim() || pathKeyword()
  if (keyword) return `${ORIGIN}/${suffix}?s=${encodeURIComponent(keyword)}`

  // 没有筛选：首页（或分类页路径由 ?path= 指定时沿用）
  const path = siteContext.pathOnly.replace(/\/page\/\d+\/?$/, '/')
  const base = path && path !== '/' ? path : '/'
  return `${ORIGIN}${base.endsWith('/') ? base : `${base}/`}${suffix}`
}

function buildListPost(opts: { id: string; href: string; previewUrl: string; width: number; height: number; title: string }) {
  const { id, href, previewUrl, width, height, title } = opts
  return {
    id,
    postView: toAbsolute(href),
    previewUrl,
    fileUrl: '',
    tags: [],
    rating: 'e',
    // Vue 2 不追踪观察后新增的属性，多图字段必须在列表阶段就存在
    images: [],
    width,
    height,
    aspectRatio: width / height,
    createdAt: null,
    title,
    fileExt: 'webp',
    fileDownloadName: `everia ${id} ${width}x${height}`,
    fileDownloadText: `${width}×${height} [webp]`,
  } as any
}

/**
 * 搜索结果页用的是主题自带的 blog 列表（8 条一页），
 * 和首页的 Elementor 网格完全不交叉：网格页 `article` 数为 0，搜索页 `rt-grid-item` 数为 0。
 */
function parseSearchCards(doc: Document): Post[] {
  return Array.from(doc.querySelectorAll<HTMLElement>('article[id^="post-"]')).flatMap(article => {
    const href = article.querySelector('a.thumbnail-link[href]')?.getAttribute('href') ?? ''
    const img = article.querySelector<HTMLImageElement>('img.wp-post-image, img')
    const previewUrl = toAbsolute(img?.getAttribute('data-src') || img?.getAttribute('src') || '')
    if (!href || !previewUrl) return []

    return [buildListPost({
      id: article.id.replace(/^post-/, '') || href,
      href,
      previewUrl,
      width: Number(img?.getAttribute('width')) || DEFAULT_WIDTH,
      height: Number(img?.getAttribute('height')) || DEFAULT_HEIGHT,
      title: article.querySelector('.search-entry-title a, h2')?.textContent?.trim() ?? '',
    })]
  })
}

async function fetchListPosts(page: number, tags?: string | null): Promise<Post[]> {
  let html: string
  try {
    html = await apiFetch(listUrl(page, tags))
  } catch {
    return []
  }
  const doc = new DOMParser().parseFromString(html, 'text/html')

  const cards = Array.from(doc.querySelectorAll('.rt-grid-item'))
  if (cards.length === 0) return parseSearchCards(doc)

  return cards.flatMap(card => {
    const href = card.querySelector('a.tpg-post-link[href]')?.getAttribute('href') ?? ''
    const img = card.querySelector<HTMLImageElement>('img.rt-img-responsive, img')
    const previewUrl = toAbsolute(img?.getAttribute('data-src') || img?.getAttribute('src') || '')
    if (!href || !previewUrl) return []

    return [buildListPost({
      // data-id 是 WP 的 post id，比 URL 稳定，也便于去重
      id: card.getAttribute('data-id') || href,
      href,
      previewUrl,
      width: Number(img?.getAttribute('width')) || DEFAULT_WIDTH,
      height: Number(img?.getAttribute('height')) || DEFAULT_HEIGHT,
      title: card.querySelector('.entry-title')?.textContent?.trim() ?? '',
    })]
  })
}

/* --------------------------------- 文章页 --------------------------------- */

interface ArticleData {
  postId: string
  title: string
  images: PostImage[]
}

let articleCache: ArticleData | null = null
let articleCacheKey = ''

function articleSlug() {
  const segment = siteContext.pathname.split('/').filter(Boolean)[3]
  if (!segment) return ''
  try {
    return decodeURIComponent(segment)
  } catch {
    return segment
  }
}

/**
 * 一篇文章的全部图片。
 *
 * 站点把正文用 `<!--nextpage-->` 切成 1–9 页、最多 135 张图，逐页抓要 9 次往返；
 * 而 REST 的 `content.rendered` 一次返回全部页的内容，分页标记只剩注释。
 */
async function loadArticle(): Promise<ArticleData | null> {
  const key = siteContext.pathname
  if (articleCache && articleCacheKey === key) return articleCache

  const slug = articleSlug()
  if (!slug) return null

  const url = `${ORIGIN}/wp-json/wp/v2/posts?slug=${encodeURIComponent(slug)}&_fields=id,title,content`
  let rows: any
  try {
    rows = JSON.parse(await apiFetch(url))
  } catch {
    return null
  }
  const post = Array.isArray(rows) ? rows[0] : null
  if (!post) return null

  const doc = new DOMParser().parseFromString(post.content?.rendered ?? '', 'text/html')
  const images: PostImage[] = Array.from(doc.querySelectorAll<HTMLImageElement>('img[src]'))
    .map(el => toAbsolute(el.getAttribute('src') ?? ''))
    // 正文里只有图片，但仍要挡掉 WP 的 emoji 之类的内联资源
    .filter(src => src.startsWith('http') && /\.(webp|jpe?g|png|gif)(\?|$)/i.test(src))
    .map(src => ({ fileUrl: src, previewUrl: src, ...sizeOf(src) }))

  articleCache = { postId: String(post.id), title: htmlToText(post.title?.rendered ?? ''), images }
  articleCacheKey = key
  return articleCache
}

async function fetchArticlePosts(page: number): Promise<Post[]> {
  const data = await loadArticle()
  if (!data || data.images.length === 0) return []

  // 虚拟布局是 93vh 的内部滚动，页面级触底事件不会触发，只能一次给全
  // （它只渲染可视区，给全不会连带加载所有图片）；其余布局按块喂，靠滚动追加
  const chunk = settings.masonryLayout === 'virtual' ? data.images.length : CHUNK_SIZE
  const start = (page - 1) * chunk
  if (start >= data.images.length) return []

  return data.images.slice(start, start + chunk).map((img, offset) => {
    const index = start + offset
    return {
      id: `${data.postId}-${index}`,
      postView: img.fileUrl,
      previewUrl: img.fileUrl,
      fileUrl: img.fileUrl,
      tags: [],
      rating: 'e',
      // 每张图自己就是一条记录，不再有多图概念
      mediaCount: 1,
      images: [],
      width: img.width,
      height: img.height,
      aspectRatio: img.width / img.height,
      createdAt: null,
      title: data.title,
      fileExt: 'webp',
      fileDownloadName: `everia ${data.postId} ${index + 1} ${img.width}x${img.height}`,
      fileDownloadText: `${img.width}×${img.height} [webp]`,
    } as any
  })
}

async function fetchArticleDetail(id: string): Promise<MultiImageDetail> {
  const data = await loadArticle()
  const index = Number(id.split('-').pop())
  const img = data?.images[index]
  if (!data || !img) return {}

  // 刻意不回传 images：文章页的连续浏览交给瀑布流本身。
  // 一旦回传，PostDetail 就会渲染整篇的缩略条，正是要避开的瓶颈。
  return { fileUrl: img.fileUrl, title: data.title, tags: [] }
}

/* --------------------------------- 适配器导出 -------------------------------- */

interface EveriaActions {
  list: SiteAdapter
  post: MultiImageAdapter
}

/**
 * 同一 host 的两个视图，靠路径互斥（`is()` 不会同时为真）：
 * - `list`：站点首页 / 分类页 / 搜索页，30 条一页
 * - `post`：文章页，把一篇的 100+ 张图当作瀑布流条目逐块喂出去
 */
export const everia: EveriaActions = {
  list: {
    is: isEveriaList,
    posts: fetchListPosts,
  },
  post: {
    is: isEveriaArticle,
    posts: fetchArticlePosts,
    detail: fetchArticleDetail,
  },
}
