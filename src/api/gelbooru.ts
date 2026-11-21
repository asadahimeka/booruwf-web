import { apiFetch, parseHTML } from './gateway'
import { currentCredentialQuery } from './booru'
import { getImageSize } from '@/utils'
import { siteContext } from '@/site-context'
import store from '@/store'

/**
 * gelbooru HTML 列表适配器（脚本版在未配置 API key 时的降级路径）。
 * 自脚本版移植：`location.href` → siteContext，fetch → apiFetch；
 * favorites / addfav（登录态）不迁移。
 *
 * 分发闸门：当前站配置了凭证（credentialQueries 按站分槽）时落到后面的
 * booruAction，走 @himeka/booru 的 gelbooru JSON 接口；本 HTML 适配器仅在
 * 无凭证时生效。siteActions 中本条目在 booruAction 之前，闸门丢了会把
 * JSON 路径整个短路掉。
 */

export function isGelbooruPage() {
  return siteContext.host == 'gelbooru.com' && !currentCredentialQuery()
}

export async function fetchGelbooruPosts(page: number, tags: string | null) {
  const url = new URL(`${siteContext.origin}/index.php`)
  url.searchParams.set('page', 'post')
  url.searchParams.set('s', 'list')
  url.searchParams.set('pid', `${(page - 1) * 42}`)
  // 脚本版是 `new URL(location.href)` 起手，宿主页面 URL 上的 `tags=` 天然被带上；
  // web 版自己拼 URL，必须显式补 —— 否则搜索词在 HTML 降级路径上完全失效（只能翻页）
  if (tags && tags !== 'all') url.searchParams.set('tags', tags)
  const html = await apiFetch(url.href)
  // parseHTML 注入 <base>：img.src / a.href 等 reflected 属性按站点域名解析
  const doc = parseHTML(html, url.href)
  const results = [...doc.querySelectorAll('.thumbnail-container .thumbnail-preview')].map(async el => {
    const img = el.querySelector('img')
    const imgSrc = img?.src || ''
    const postView = el.querySelector('a')?.href
    const id = postView?.match(/id=(\d+)/)?.[1]
    // 缩略图带防盗链（302 → hotlink.php），测量尺寸也要经服务端 /img 伪装 Referer
    const { width, height } = await getImageSize(store.proxyImg(imgSrc) || '')
    const tags = img?.title.split(/\s+/).filter(Boolean)
    const isGif = ['animated_gif', 'gif'].some(e => tags?.includes(e))
    const isVideo = ['mp4', 'video'].some(e => tags?.includes(e))
    let rating = img?.title?.match(/rating:(\w)\w+/)?.[1]
    if (rating == 'g') rating = 's'

    return {
      id,
      postView,
      previewUrl: imgSrc,
      sampleUrl: isVideo
        ? imgSrc.replace(/(.*)thumbnails(.*)thumbnail_(.*)\.jpg/i, '$1images$2$3.mp4')
        : isGif
          ? imgSrc.replace(/(.*)thumbnails(.*)thumbnail_(.*)\.jpg/i, '$1images$2$3.gif')
          : imgSrc.replace(/(.*)thumbnails(.*)thumbnail_(.*)/i, '$1samples$2sample_$3'),
      fileUrl: isVideo
        ? imgSrc.replace(/(.*)thumbnails(.*)thumbnail_(.*)\.jpg/i, '$1images$2$3.webm')
        : isGif
          ? imgSrc.replace(/(.*)thumbnails(.*)thumbnail_(.*)\.jpg/i, '$1images$2$3.gif')
          : imgSrc.replace(/(.*)thumbnails(.*)thumbnail_(.*)\.jpg/i, '$1images$2$3.jpg'),
      tags,
      width: width * 10,
      height: height * 10,
      aspectRatio: width / height,
      fileExt: isVideo ? 'webm' : isGif ? 'gif' : 'jpg',
      fileDownloadName: `gelbooru_${id}`,
      rating: rating || '',
    } as any
  })
  return Promise.all(results)
}

export const gelbooru = {
  is: isGelbooruPage,
  posts: fetchGelbooruPosts,
}
