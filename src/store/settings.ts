import type { DownloadUrlKey } from '@/utils/download-source'

export interface SzurubooruConfig {
  domain: string
  username: string
  token: string
}

export const langList = [
  { value: 'zh-Hans', label: '简体中文' },
  { value: 'zh-Hant', label: '繁體中文' },
  { value: 'ja', label: '日本語' },
  { value: 'en', label: 'English' },
] as const

const langMap: Record<string, typeof langList[number]['value']> = {
  'zh': 'zh-Hans',
  'zh-CN': 'zh-Hans',
  'zh-TW': 'zh-Hant',
  'zh-HK': 'zh-Hant',
  'zh-MO': 'zh-Hant',
  'zh-SG': 'zh-Hans',
  'ja': 'ja',
  'ja-JP': 'ja',
  'en': 'en',
  'en-US': 'en',
  'en-GB': 'en',
}

const isMobile = navigator.userAgent.includes('Mobile')
const defaultSettings = {
  lang: langMap[navigator.language] || 'en',
  darkMode: 'light' as 'light' | 'dark',
  blacklist: localStorage.getItem('__blacklist')?.split(',').filter(Boolean) || [] as string[],
  selectedColumn: '0',
  // 默认关闭（与 web 版一致：旧实现 `!!localStorage.getItem('__showNSFW')`）。
  // 开启时设置抽屉弹 18+ 确认框；关闭后 NSFW 站点从导航隐藏、rating 'e' 帖子被过滤
  showNSFWContents: false,
  isListenWheelEvent: true,
  isFullImgPreload: false,
  imgPreloadNum: 1,
  masonryLayout: 'masonry' as 'masonry' | 'grid' | 'justified' | 'virtual' | 'masonry2',
  isListenKeyupEvent: true,
  // API 凭证（如 danbooru 的 &api_key=xx&user_id=1）按站点域名分槽存储：
  // web 版单 SPA 自由切站，全局单值会把 A 站的 key 挂到 B 站请求上（脚本版
  // 单宿主站点无此问题）。旧版全局单值 credentialQuery 无法确定归属站点，弃用不迁移。
  credentialQueries: {} as Record<string, string>,
  isThumbSampleUrl: false,
  showPostCheckbox: false,
  useFancybox: false,
  isHoldsFalse: false,
  isYandereFetchByHtml: false,
  showListPostReso: false,
  // 悬停缩略图时内联播放视频/动图（gif）；按钮播放不受此开关控制
  inlineHoverPlay: false,
  isFitScreen: true,
  isDLSubpath: false,
  autoWaterfall: false,
  autoHideAppBar: true,
  showTagChipGroup: false,
  justifiedBaseWidth: isMobile ? 240 : 340,
  detailButtonsBottom: isMobile,
  // 详情弹窗里显示多图帖的缩略图条（工具栏上有按钮可随时收起/展开）
  showDetailThumbs: true,
  closePopupOnImgClick: isMobile,
  downloadBy: 'fsa' as 'fsa' | 'server' | 'newtab',
  downloadUrlKey: 'fileUrl' as DownloadUrlKey,
  // web 版特有：图片代理方式（'__server' = 同源服务端 /img 网关）
  imgProxy: '__server',
  // web 版特有：API 代理方式（'__server' = 同源服务端 /proxy 网关）。
  // 与图片代理分开配置：API 需要伪装 Referer/UA 与挑战应答，第三方前缀代理
  // 通常做不了这些，默认走内置服务端；图片代理则可以按网络环境换第三方
  apiProxy: '__server',
  // szurubooru 自部署支持：多站点配置（域名/凭据），存 GM 存储（脚本级、跨域名共享），localStorage 仅作副本
  szurubooruConfigs: [] as SzurubooruConfig[],
}

export const initialSettings: typeof defaultSettings = {
  ...defaultSettings,
  ...(() => {
    try {
      return JSON.parse(localStorage.getItem('YM_APP_SETTINGS') || '{}')
    } catch (err) {
      return {}
    }
  })(),
}
