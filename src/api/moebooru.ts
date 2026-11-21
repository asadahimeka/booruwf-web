import { Post, SearchResults, forSite } from '@himeka/booru'
import { formatDate } from '../utils'
import { apiFetch, apiFetchJson } from './gateway'
import i18n from '@/utils/i18n'
import { siteContext } from '@/site-context'
import store, { settings } from '@/store'

/**
 * moebooru 系（yande.re / konachan 等）适配器。
 *
 * 自脚本版移植的改动：
 * - `location.*` → `siteContext`（web 版站点上下文，?site= / ?path= 驱动）
 * - 同源相对路径 fetch → `apiFetch`（走服务端 /proxy）
 * - 登录态相关（getUsername / checkPostIsVoted / addPostToFavorites）不迁移
 * - 宿主页面专属的 tag 补全（TagCompletion / recent_tags）不迁移
 */

export interface PostDetail {
  voted?: boolean
  tags?: {
    tag: string
    tagText: string
    color: string
    type: string
  }[]
}

const tagInfoMap: Record<string, any[]> = {
  circle: [i18n.t('ZtQHZx-pEjmu_o3dQD1fc'), '#26C6DA'],
  artist: [i18n.t('Ym0HIEu9Q80qXB31LuC6c'), '#FB8C00'],
  copyright: [i18n.t('juT6gwLOg5r1h2vFpFf6P'), '#AB47BC'],
  character: [i18n.t('aonlPAu9kEkkwNvQg0DBk'), '#66BB6A'],
  general: ['', '#E87A90cc'],
  faults: ['', '#AB3B3Ada'],
}
const tagSortOrder = ['circle', 'artist', 'copyright', 'character', 'general']
const isCNLang = i18n.locale.includes('zh')

export async function getPostDetail(id: string): Promise<PostDetail | false> {
  try {
    if (!id) return false
    // 投票状态依赖登录态（include_votes + cookie），web 版不做登录态，voted 恒为 false
    const result = await apiFetchJson<any>(
      `${siteContext.origin}/post.json?api_version=2&tags=id:${id}&include_tags=1`,
    )
    const tagsCN = window.__tagsCN
    return {
      voted: false,
      tags: Object.entries<string>(result.tags).map(([tag, type]) => {
        const tagCN = isCNLang && tagsCN?.[tag]
        const typeText = tagInfoMap[type]?.[0]
        const tagText = [
          typeText && `[ ${typeText} ] `,
          tag,
          tagCN && ` [ ${tagCN} ]`,
        ].filter(Boolean).join('')
        return {
          tag,
          type,
          tagText,
          color: tagInfoMap[type]?.[1] || tagInfoMap.general[1],
        }
      }).sort((a, b) => {
        return tagSortOrder.indexOf(a.type) - tagSortOrder.indexOf(b.type)
      }),
    }
  } catch (error) {
    console.log('getPostDetail error:', error)
    return false
  }
}

export function isPopularPage() {
  return /(yande.re|konachan).*\/post\/popular_/.test(siteContext.host + siteContext.pathname)
}

export function isPoolShowPage() {
  return /(yande.re|konachan).*\/pool\/show/.test(siteContext.host + siteContext.pathname)
}

export async function fetchPostsByPath(postsKey?: string, page?: number): Promise<SearchResults> {
  const url = new URL(`${siteContext.origin}${siteContext.pathname}`)
  url.pathname += '.json'
  page && url.searchParams.set('page', page.toString())
  const result = await apiFetchJson<any>(url)
  const site = forSite(siteContext.host)
  const results: [] = postsKey ? result[postsKey] : result
  const posts = results.map(e => new Post(e, site))
  return new SearchResults(posts, [], {}, site)
}

export function isYandereHtml() {
  return siteContext.host == 'yande.re' && siteContext.pathname == '/post' && settings.isYandereFetchByHtml
}

export async function fetchPostsByHtml(page: number, tags: string | null): Promise<SearchResults> {
  const url = new URL(`${siteContext.origin}${siteContext.pathname || '/post'}`)
  url.searchParams.set('page', `${page}`)
  tags && url.searchParams.set('tags', tags)
  const html = await apiFetch(url.href)
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const script = doc.querySelector<HTMLScriptElement>('form:has(select[name=locale]) + script')

  const scriptText = script?.innerText.trim() || ''
  let results: any[] = []
  try {
    results = scriptText.split('\n').slice(1).map(e => JSON.parse(e.match(/Post.register\((.*)\)/)?.[1] || '[]'))
  } catch (err) {
    console.log('err: ', err)
  }

  const site = forSite(siteContext.host)
  const posts = results.map((e: any) => new Post(e, site))
  return new SearchResults(posts, [], {}, site)
}

export interface Pool {
  created_at: string
  description: string
  id: string
  name: string
  post_count: number
  updated_at: string
  user_id: string
  thumb?: string
}

export async function fetchPools(page: number, query?: string): Promise<Pool[]> {
  const url = new URL(`${siteContext.origin}/pool.json`)
  url.searchParams.set('page', page.toString() || '1')
  query && url.searchParams.set('query', query)
  const results = await apiFetchJson<Pool[]>(url)
  url.pathname = url.pathname.replace('.json', '.atom')
  const xml = await apiFetch(url)
  const doc = new DOMParser().parseFromString(xml, 'text/xml')
  const thumbMap = [...doc.querySelectorAll('entry')].reduce<Record<string, string>>((acc, cur) => {
    const id = cur.querySelector('id')?.textContent?.match(/Pool\/(\d+)/)?.[1]
    const url = cur.querySelector('link[rel=enclosure]')?.getAttribute('href')
    if (id && url) acc[id] = url
    return acc
  }, {})
  for (const item of results) {
    item.thumb = thumbMap[item.id]
    item.created_at = formatDate(new Date(item.created_at))
    item.updated_at = formatDate(new Date(item.updated_at))
  }
  return results
}

export const moebooru = {
  yanderehtml: {
    is: isYandereHtml,
    posts: fetchPostsByHtml,
  },
  popular: {
    is: isPopularPage,
    posts: async () => {
      const results = await fetchPostsByPath()
      store.requestStop = true
      return results
    },
  },
  pool: {
    is: isPoolShowPage,
    posts: async (page: number, tags: string | null) => {
      const results = await fetchPostsByPath('posts', page)
      return tags ? results.tagged(tags) : results
    },
  },
}
