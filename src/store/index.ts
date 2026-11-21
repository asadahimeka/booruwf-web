import Vue from 'vue'
import type { Post } from '@himeka/booru'
import { initialSettings } from './settings'
import { siteContext } from '@/site-context'
import { toProxyImgUrl } from '@/api/gateway'

export const settings = Vue.observable(initialSettings)

interface SeletedPost extends Post {
  loading?: boolean
  loaded?: boolean
  fileNameWithTags?: string
}

const ykFlag = ['konachan', 'yande.re'].some(e => siteContext.host.includes(e))
const poolFlag = Boolean(siteContext.pathname.includes('pool'))

/**
 * 内置图片代理标记：走同源服务端 /img 网关。
 * gelbooru 等站缩略图带防盗链（302 → hotlink.php），浏览器直连会被拦/挂起，
 * 必须经服务端按站点规则伪装 Referer。脚本版无此问题（页面就在站点域名上）。
 */
export const SERVER_IMG_PROXY = '__server'

/**
 * 内置 API 代理标记：走同源服务端 /proxy 网关（apiFetch 读它）。
 * 前缀型第三方代理只做 URL 拼接，伪装/挑战应答做不了，默认不适用 API。
 */
export const SERVER_API_PROXY = '__server'

export const imgProxys = [
  { text: '不使用', value: '' },
  { text: '默认', value: SERVER_IMG_PROXY },
  ...(import.meta.env.VITE_APP_PROXYS as string || '').split(';').filter(Boolean).map(e => {
    const [text, value] = e.split(',')
    return { text, value }
  }),
]

/** API 代理可选项：第三方前缀代理 + 内置服务端（「不使用」对 API 无意义） */
export const apiProxys = [
  { text: '默认', value: SERVER_API_PROXY },
  ...(import.meta.env.VITE_APP_PROXYS as string || '').split(';').filter(Boolean).map(e => {
    const [text, value] = e.split(',')
    return { text, value }
  }),
]

function proxyImgImpl(url?: string | null): string | undefined {
  if (!url) return undefined
  return (settings.imgProxy === SERVER_IMG_PROXY ? toProxyImgUrl(url) : settings.imgProxy + url) ?? undefined
}

export const store = Vue.observable({
  requestLoading: false,
  requestStop: false,
  showImageSelected: false,
  imageSelectedIndex: 0,
  showDrawer: false,
  showSettings: false,
  showFab: false,
  currentPage: 1,
  imageList: [] as Post[],
  selectedImageList: [] as SeletedPost[],
  isYKSite: ykFlag,
  showPostList: !poolFlag,
  showPoolList: ykFlag && poolFlag,
  isFullscreen: false,
  proxyImg: proxyImgImpl,
})

export function toggleDrawer() {
  store.showDrawer = !store.showDrawer
}

export function addToSelectedList(item: Post) {
  if (store.selectedImageList.some(e => e.id === item.id)) return
  Object.assign(item, { fileNameWithTags: `${siteContext.host} ${item.id} ${item.tags.join(' ')}` })
  store.selectedImageList.push(item)
}

export function removeFromSelectedList(id: string) {
  store.selectedImageList = store.selectedImageList.filter(e => {
    if (e.loading) return true
    return e.id !== id
  })
}

export default store
