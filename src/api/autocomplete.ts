import { apiFetch } from './gateway'
import { fetchSzurubooruAutocomplete, isSzurubooru } from './szurubooru'
import { siteContext } from '@/site-context'

async function fetchDanbooruAutocomplete(term: string) {
  try {
    const text = await apiFetch(`https://danbooru.donmai.us/autocomplete.json?search[query]=${term}&search[type]=tag_query&version=1&limit=20`)
    const result = JSON.parse(text) as any[]
    return result.map(e => e.value as string)
  } catch {
    return []
  }
}

async function fetchGelbooruAutocomplete(term: string) {
  const text = await apiFetch(`https://gelbooru.com/index.php?page=autocomplete2&term=${term}&type=tag_query&limit=10`)
  const result = JSON.parse(text) as any[]
  return result.map(e => e.value as string)
}

async function fetchRule34Autocomplete(term: string) {
  const text = await apiFetch(`https://ac.rule34.xxx/autocomplete.php?q=${term}`)
  const result = JSON.parse(text) as any[]
  return result.map(e => e.value as string)
}

async function fetchEshuushuuAutocomplete(term: string) {
  term = term.replace(/#\d+$/, '')
  const text = await apiFetch(`https://e-shuushuu.net/api/v1/tags/?search=${term}&limit=10`)
  const result = JSON.parse(text) as { tags: any[] }
  return result.tags.map(e => `${e.title}#${e.tag_id}`)
}

// moebooru 系：/tag.json?name= 前缀匹配 + order=count 热度优先，
// 与站内搜索框补全同一数据源（脚本版当时依赖宿主页面自己的补全，web 版直接调 API）。
// 限制：仅前缀命中，不解析 tag_aliases（别名需完整输入旧名才查得到）。
// 实测：yande.re / konachan.net / www.sakugabooru.com 可用；
// konachan.com 有 CF JS 挑战（同 sankaku）、behoimi.org / lolibooru.moe 网络不可达，均静默降级为 []。
async function fetchMoebooruAutocomplete(term: string) {
  try {
    const text = await apiFetch(`https://${siteContext.host}/tag.json?name=${encodeURIComponent(term)}&limit=20&order=count`)
    const result = JSON.parse(text) as Array<{ name: string }>
    return result.map(e => e.name)
  } catch {
    return []
  }
}

const autocompleteActions: Record<string, (term: string) => Promise<string[]>> = {
  'yande.re': fetchMoebooruAutocomplete,
  'konachan.com': fetchMoebooruAutocomplete,
  'konachan.net': fetchMoebooruAutocomplete,
  'behoimi.org': fetchMoebooruAutocomplete,
  'www.sakugabooru.com': fetchMoebooruAutocomplete,
  'lolibooru.moe': fetchMoebooruAutocomplete,
  'danbooru.donmai.us': fetchDanbooruAutocomplete,
  'gelbooru.com': fetchGelbooruAutocomplete,
  'rule34.xxx': fetchRule34Autocomplete,
  'e-shuushuu.net': fetchEshuushuuAutocomplete,
}

// 自部署 szurubooru 的域名是用户配置的，无法按 host 建表，走统一判定
export const isAutocompleteAct = isSzurubooru()
  || Object.keys(autocompleteActions).includes(siteContext.host)
export const fetchAutocomplete = isSzurubooru()
  ? fetchSzurubooruAutocomplete
  : autocompleteActions[siteContext.host] || (() => {})
