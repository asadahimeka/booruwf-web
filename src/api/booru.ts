import { search, sites } from '@himeka/booru'

const blackList = new Set(['behoimi.org', 'e621.net', 'e926.net', 'hypnohub.net', 'derpibooru.org'])
export const siteDomains = Object.keys(sites).filter(e => !blackList.has(e))

const defaultLimitMap: Record<string, number> = {
  'yande.re': 40,
  'konachan.com': 21,
  'konachan.net': 21,
  'danbooru.donmai.us': 20,
  'gelbooru.com': 42,
  'rule34.xxx': 42,
  'safebooru.org': 40,
  'tbib.org': 42,
  'xbooru.com': 42,
  'rule34.paheal.net': 70,
  'realbooru.com': 42,
}

export function getCurrSite() {
  const params = new URLSearchParams(location.search)
  const site = params.get('site')
  return (site && siteDomains.includes(site)) ? site : 'yande.re'
}

const host = getCurrSite()

export const BOORU_PAGE_LIMIT = defaultLimitMap[host] || 40

export const isPidSite = sites[host]?.paginate === 'pid'

export async function searchBooru(page: number, tags: string | null) {
  if (!tags || tags === 'all') tags = ''
  if (host === 'konachan.net') tags += ' rating:safe'
  return search(host, tags, { page, limit: BOORU_PAGE_LIMIT })
}

let tags: Record<string, string> | null = null
export async function getTranslatedTags() {
  if (!tags) {
    const response = await fetch('https://fastly.jsdelivr.net/gh/asadahimeka/yandere-masonry@main/src/data/tags_cn.json')
    tags = await response.json()
  }
  return tags
}
