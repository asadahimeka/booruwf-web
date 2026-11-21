import { apiFetch, parseHTML } from './gateway'
import { siteContext } from '@/site-context'

export function isHentaiBooruPage() {
  return siteContext.host == 'booru.eu'
}

// 站点的标签路由把 `/` 转义成 `^s`（fate/grand_order -> fate^sgrand_order），多标签用 + 连接
function tagsToPath(tags: string) {
  return tags
    .trim()
    .split(/\s+/)
    .map(tag => encodeURIComponent(tag.replace(/\//g, '^s')))
    .join('+')
}

export function hentaibooruSearchUrl(tag: string) {
  return `https://booru.eu/post/list/${tagsToPath(tag)}/1`
}

export async function fetchHentaiBooruPosts(page: number, tags: string | null) {
  const url = `https://booru.eu/post/list${tags ? `/${tagsToPath(tags)}` : ''}/${page}`
  const html = await apiFetch(url)
  // parseHTML 注入 <base>：a.href 等 reflected 属性按站点域名解析
  const doc = parseHTML(html, url)
  const results = [...doc.querySelectorAll('.shm-image-list span.thumb')].map(el => {
    const a = el.querySelector('a')
    const img = el.querySelector('img')
    const id = a?.getAttribute('data-post-id')

    // web 版：src 是相对路径（/_thumbs/...），脚本版靠宿主页面域名解析；
    // 这里必须手动补 origin，否则浏览器会向 localhost 请求
    const previewUrl = img?.getAttribute('src') ? new URL(img.getAttribute('src')!, url).href : ''
    const tags = a?.getAttribute('data-tags')?.split(/\s/).filter(Boolean) || []
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [_, width, height] = img?.title.match(/\/\/\s+(\d+)x(\d+)\s+\/\//) || []
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [__, size] = img?.title.match(/\/\/\s+\d+x\d+\s+\/\/\s+([\w\.]+)/) || []

    return {
      id,
      postView: a?.href,
      previewUrl,
      fileUrl: '',
      tags,
      width: Number(width),
      height: Number(height),
      aspectRatio: Number(width) / Number(height),
      fileExt: 'jpg',
      fileDownloadName: `HentaiBooru ${id} ${tags.join(' ')}`,
      fileDownloadText: `${width}×${height} [${size}]`,
      rating: '',
    } as any
  })
  return results
}

export async function getHentaiBooruDetail(id: string) {
  const detailUrl = `https://booru.eu/post/view/${id}`
  const html = await apiFetch(detailUrl)
  const doc = parseHTML(html, detailUrl)
  // 主图同样是相对路径（/_images/...），需补全 origin
  const src = doc.querySelector<HTMLImageElement>('#main_image')?.getAttribute('src')
  return {
    fileUrl: src ? new URL(src, detailUrl).href : undefined,
  }
}

export const hentaibooru = {
  is: isHentaiBooruPage,
  posts: fetchHentaiBooruPosts,
  detail: getHentaiBooruDetail,
}
