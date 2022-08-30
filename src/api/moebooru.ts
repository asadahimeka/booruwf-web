import { forSite } from '@himeka/booru'
import Post from '@himeka/booru/dist/structures/Post'
import SearchResults from '@himeka/booru/dist/structures/SearchResults'
import { formatDate, showMsg } from '../utils'
import { getCurrSite, getTranslatedTags } from './booru'

const host = getCurrSite()

export interface PostDetail {
  voted?: boolean
  tags?: {
    tag: string
    tagText: string
    color: string
    type: string
  }[]
}

const tagInfoMap: Record<string, string[]> = {
  circle: ['社团', '#00bbbbcc'],
  artist: ['画师', '#FFB11Bf1'],
  copyright: ['版权', '#C1328Ede'],
  character: ['角色', '#00aa00cc'],
  general: ['', '#E87A90cc'],
  faults: ['', '#AB3B3Ada'],
}
// const tagSortOrder = ['circle', 'artist', 'copyright', 'character', 'general']
export async function getPostDetail(id: string): Promise<PostDetail | false> {
  try {
    if (!id) return false
    // TODO: Use credentials
    // const response = await fetch(`https://kw.cocomi.cf/https://${host}/post.json?api_version=2&tags=id:${id}&include_tags=1&include_votes=1`)
    const response = await fetch(`https://kw.cocomi.cf/https://${host}/post.json?api_version=2&tags=id:${id}&include_tags=1`)
    const result = await response.json()
    const tagsCN = await getTranslatedTags()
    return {
      // voted: result.votes[id] == 3,
      voted: false,
      tags: Object.entries<string>(result.tags).map(([tag, type]) => {
        const tagCN = tagsCN?.[tag]
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
      })/* .sort((a, b) => {
        return tagSortOrder.indexOf(a.type) - tagSortOrder.indexOf(b.type)
      }) */,
    }
  } catch (error) {
    console.log('getPostDetail error:', error)
    return false
  }
}

export async function addPostToFavorites(id: string) {
  const form = new FormData()
  form.append('id', id)
  form.append('score', '3')
  // TODO: Use credentials
  const response = await fetch(`https://${host}/post/vote.json`, {
    method: 'POST',
    headers: { 'x-csrf-token': sessionStorage.getItem('csrf-token') ?? '' },
    body: form,
  })
  if (!response.ok) {
    showMsg({ msg: `收藏失败: ${response.status}`, type: 'error' })
    return false
  }
  const result = await response.json()
  if (result.success) {
    showMsg({ msg: '收藏成功' })
    return true
  } else {
    showMsg({ msg: `收藏失败: ${result.reason}`, type: 'error' })
    return false
  }
}

export function isPopularPage() {
  const params = new URLSearchParams(location.search)
  return /(yande.re|konachan).*\/post\/popular_/.test(`${host}${params.get('path')}`)
}

export function isPoolShowPage() {
  const params = new URLSearchParams(location.search)
  return /(yande.re|konachan).*\/pool\/show/.test(`${host}${params.get('path')}`)
}

export async function fetchPostsByPath(postsKey?: string, page?: number): Promise<SearchResults> {
  const params = new URLSearchParams(location.search)
  const url = new URL(`https://kw.cocomi.cf/https://${host}${params.get('path')}`)
  url.pathname += '.json'
  page && url.searchParams.set('page', page.toString())
  const response = await fetch(url)
  const result = await response.json()
  const site = forSite(host)
  const results: [] = postsKey ? result[postsKey] : result
  const posts = results.map(e => new Post(e, site))
  return new SearchResults(posts, [], {}, site)
}

function splitTags(tagsData: string, limit: number, searchTerm?: string) {
  let results = tagsData?.split(/\s+/)
  if (searchTerm) results = results.filter(e => e.includes(searchTerm))
  if (!Array.isArray(results)) return []
  return results.slice(0, limit).map(e => e.split('`')[1]).filter(Boolean)
}

function getTagsString(key: string): string {
  return (window as any).TagCompletion?.[key] || localStorage.getItem(key) || ''
}

export function searchTagsByName(searchTerm?: string) {
  if (!searchTerm) return []
  return splitTags(getTagsString('tag_data'), 40, searchTerm)
}

export function getRecentTags() {
  return splitTags(getTagsString('recent_tags'), 10)
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
  const url = new URL(`https://kw.cocomi.cf/https://${host}/pool.json`)
  url.searchParams.set('page', page.toString() || '1')
  query && url.searchParams.set('query', query)
  const jsonResp = await fetch(url)
  const results: Pool[] = await jsonResp.json()
  url.pathname = url.pathname.replace('.json', '.atom')
  const xmlResp = await fetch(url)
  const doc = new DOMParser().parseFromString(await xmlResp.text(), 'text/xml')
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
