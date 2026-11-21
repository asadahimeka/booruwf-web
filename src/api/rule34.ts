import { apiFetch, parseHTML } from './gateway'
import { currentCredentialQuery } from './booru'
import { getImageSize } from '@/utils'
import { siteContext } from '@/site-context'
import store from '@/store'

/**
 * rule34.xxx HTML 列表适配器（未配置当前站凭证时的降级路径）。
 * 自脚本版移植：`location.href` → siteContext，fetch → apiFetch（credentials 移除）；
 * favorites / addfav（登录态）不迁移。脚本版的 Firefox UA 分支是脚本环境特有
 * （GM_xhr CORS），web 版统一走 /proxy 无浏览器差异，不迁移。
 *
 * 分发闸门：当前站配置了凭证（credentialQueries 按站分槽）时落到后面的
 * booruAction，走 @himeka/booru 的 api.rule34.xxx JSON 接口（dapi）。
 * siteActions 中本条目在 booruAction 之前，闸门丢了会把 JSON 路径整个短路掉。
 */

export function isRule34Page() {
  return siteContext.host == 'rule34.xxx'
}

/** HTML 降级路径的闸门：当前站未配置 API 凭证 */
export function isRule34NoLogin() {
  return isRule34Page() && !currentCredentialQuery()
}

export async function fetchRule34Posts(page: number, tags: string | null) {
  const url = new URL(`${siteContext.origin}/index.php`)
  url.searchParams.set('page', 'post')
  url.searchParams.set('s', 'list')
  url.searchParams.set('pid', `${(page - 1) * 42}`)
  tags && url.searchParams.set('tags', tags)
  const html = await apiFetch(url.href)
  // parseHTML 注入 <base>：img.src / a.href 等 reflected 属性按站点域名解析
  const doc = parseHTML(html, url.href)
  const results = [...doc.querySelectorAll('#content .image-list .thumb')].map(async el => {
    const id = el.id
    const img = el.querySelector('img')
    const imgSrc = img?.src || ''
    const postView = el.querySelector('a')?.href
    // 缩略图带防盗链，测量尺寸经服务端 /img 伪装 Referer
    const { width, height } = await getImageSize(store.proxyImg(imgSrc) || '')
    const tags = img?.title.split(/\s+/).filter(Boolean)
    const isVideo = ['mp4', 'video'].some(e => tags?.includes(e))
    const videoUrl = imgSrc.replace(/(.*)thumbnails(.*)thumbnail_(.*)\.jpg/i, '$1images$2$3.mp4').replace('https://wimg.', 'https://api-cdn-mp4.')
    const rating = img?.title.match(/rating\:(\w)/)?.[1]
    const score = img?.title.match(/score\:(\d+)/)?.[1]

    if (el.querySelector('.blacklist-img')) {
      return null
    }

    return {
      id,
      postView,
      previewUrl: imgSrc,
      sampleUrl: isVideo ? videoUrl : imgSrc.replace(/(.*)thumbnails(.*)thumbnail_(.*)/i, '$1samples$2sample_$3'),
      fileUrl: isVideo ? videoUrl.replace(/\?\d+$/, '') : imgSrc.replace(/(.*)thumbnails(.*)thumbnail_(.*)\.jpg/i, '$1images$2$3.jpeg').replace(/\?\d+$/, ''),
      tags,
      width: width * 10,
      height: height * 10,
      aspectRatio: width / height,
      fileExt: isVideo ? 'mp4' : 'jpg',
      fileDownloadName: `rule34_xxx_${id}`,
      rating,
      score,
    } as any
  })
  const posts = await Promise.all(results)
  return posts.filter(Boolean)
}

export const rule34 = {
  is: isRule34Page,
  nologin: {
    is: isRule34NoLogin,
    posts: fetchRule34Posts,
  },
}
