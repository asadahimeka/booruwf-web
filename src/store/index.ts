import Vue from 'vue'
import type { Post } from '@himeka/booru'

interface SeletedPost extends Post {
  loading?: boolean
  loaded?: boolean
}

interface AppState {
  requestState: boolean
  requestStop: boolean
  showImageSelected: boolean
  imageSelectedIndex: number
  showDrawer: boolean
  showFab: boolean
  currentPage: number
  blacklist: string[]
  imageList: Post[]
  selectedImageList: SeletedPost[]
  selectedColumn: string
  isYKSite: boolean
  showPostList: boolean
  showPoolList: boolean
  showNSFWContents: boolean
  imgProxy: string
  imgProxys: {}[]
  apiProxy: string
  apiProxys: {}[]
  toggleDrawer: () => void
  addToSelectedList: (item: Post) => void
}

const params = new URLSearchParams(location.search)
const ykFlag = ['konachan', 'yande.re'].some(e => {
  const site = params.get('site')
  return site ? site.includes(e) : true
})
const poolFlag = Boolean(params.get('path')?.includes('pool'))

export const imgProxys = [
  { text: '不使用', value: '' },
  ...(import.meta.env.VITE_APP_PROXYS as string || '').split(';').map(e => {
    const [text, value] = e.split(',')
    return { text, value }
  }),
]

export const apiProxys = imgProxys.slice(1)

const store = Vue.observable<AppState>({
  requestState: false,
  requestStop: false,
  showImageSelected: false,
  imageSelectedIndex: 0,
  showDrawer: false,
  showFab: false,
  currentPage: 1,
  imageList: [],
  blacklist: localStorage.getItem('__blacklist')?.split(',').filter(Boolean) || [],
  selectedImageList: [],
  selectedColumn: localStorage.getItem('__masonry_col') ?? '0',
  isYKSite: ykFlag,
  showPostList: !poolFlag,
  showPoolList: ykFlag && poolFlag,
  showNSFWContents: !!localStorage.getItem('__showNSFW'),
  imgProxy: localStorage.getItem('__imgProxy') ?? imgProxys[0].value,
  imgProxys,
  apiProxy: localStorage.getItem('__apiProxy') ?? apiProxys[0].value,
  apiProxys,
  toggleDrawer() {
    store.showDrawer = !store.showDrawer
  },
  addToSelectedList(item) {
    if (store.selectedImageList.some(e => e.id === item.id)) return
    store.selectedImageList.push(item)
  },
})

export default store
