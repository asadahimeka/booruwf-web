import { apiFetch, normalizeSzuruDomain } from './gateway'
import { settings } from '@/store'
import { siteContext } from '@/site-context'

export const SZURU_DEMO_HOST = 'nekomaru.moe'

const PAGE_LIMIT = 40

const safetyRatingMap: Record<string, string> = {
  safe: 's',
  sketchy: 'q',
  unsafe: 'e',
}

export { normalizeSzuruDomain }

export function isConfiguredSzuruDomain(host: string) {
  return settings.szurubooruConfigs.some(c => normalizeSzuruDomain(c.domain) === host)
}

export function isSzurubooru() {
  return siteContext.host === SZURU_DEMO_HOST
    || isConfiguredSzuruDomain(siteContext.host)
}

function currentConfig() {
  if (siteContext.host === SZURU_DEMO_HOST) {
    return settings.szurubooruConfigs.find(c => normalizeSzuruDomain(c.domain) === SZURU_DEMO_HOST)
  }
  return settings.szurubooruConfigs.find(c => normalizeSzuruDomain(c.domain) === siteContext.host)
}

export function szuruAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = { Accept: 'application/json' }
  const config = currentConfig()
  if (config?.username && config?.token) {
    try {
      headers.Authorization = `Token ${btoa(`${config.username}:${config.token}`)}`
    } catch (error) {
      console.warn('[YM] szurubooru auth encode failed:', error)
    }
  }
  return headers
}

function absUrl(url: string) {
  return new URL(url, siteContext.origin).href
}

export async function fetchSzurubooruPosts(page: number, tags: string | null) {
  const url = new URL('/api/posts/', siteContext.origin)
  url.searchParams.set('offset', `${(page - 1) * PAGE_LIMIT}`)
  url.searchParams.set('limit', `${PAGE_LIMIT}`)
  if (tags && tags !== 'all') {
    url.searchParams.set('query', tags)
  }
  const text = await apiFetch(url.href, { headers: szuruAuthHeaders() })
  const json = JSON.parse(text)
  return (json.results || []).map((e: any) => {
    const fileExt = e.mimeType?.split('/')[1] || String(e.contentUrl || '').split('.').pop() || 'jpg'
    const width = e.canvasWidth || 0
    const height = e.canvasHeight || 0
    return {
      id: String(e.id),
      postView: `${siteContext.origin}/post/${e.id}`,
      previewUrl: e.thumbnailUrl ? absUrl(e.thumbnailUrl) : null,
      sampleUrl: null,
      fileUrl: e.contentUrl ? absUrl(e.contentUrl) : null,
      tags: (e.tags || []).map((t: any) => t.names?.[0] || t),
      width,
      height,
      aspectRatio: height ? width / height : 1,
      fileExt,
      fileDownloadName: `szurubooru_${e.id}_${width}×${height}.${fileExt}`,
      rating: safetyRatingMap[e.safety] || 'u',
      score: e.score || 0,
      source: e.source || null,
      createdAt: e.creationTime ? new Date(e.creationTime) : null,
    } as any
  })
}

export const szurubooru = {
  is: isSzurubooru,
  posts: fetchSzurubooruPosts,
}

/**
 * 标签补全。
 *
 * 标准 szurubooru 走 `/api/tag-suggestions/?query=`（匿名可用的字符串数组）；
 * 部分实例/分支没有这个路由（实测 h.7279744.xyz 返回 404 Route not found），
 * 回退到 `/api/tags/?query=`（需认证，返回 {results:[{names}]}）。
 * 两者都失败时静默降级为空列表。
 */
export async function fetchSzurubooruAutocomplete(term: string) {
  try {
    const text = await apiFetch(
      `${siteContext.origin}/api/tag-suggestions/?query=${encodeURIComponent(term)}`,
      { headers: szuruAuthHeaders() },
    )
    const result = JSON.parse(text) as string[]
    if (Array.isArray(result)) return result.slice(0, 20)
  } catch {
    // 无该路由（404）或不可用：走 tags 搜索回退
  }
  try {
    const text = await apiFetch(
      `${siteContext.origin}/api/tags/?query=${encodeURIComponent(term)}&limit=20`,
      { headers: szuruAuthHeaders() },
    )
    const result = JSON.parse(text) as { results?: Array<{ names?: string[] }> }
    return (result.results || [])
      .map(e => e.names?.[0])
      .filter((name): name is string => !!name)
      .slice(0, 20)
  } catch {
    return []
  }
}
