import { apiFetch, parseHTML, toProxyImgUrl } from './gateway'
import { getImageSize } from '@/utils'
import { siteContext } from '@/site-context'

export function isKusowankaPage() {
  return siteContext.host == 'kusowanka.com'
}

export async function fetchKusowankaPosts(page: number, tags: string | null) {
  const url = new URL(`https://kusowanka.com${tags ? `/tag/${tags}/` : ''}`)
  url.searchParams.set('page', `${page}`)
  const html = await apiFetch(url.href)
  // parseHTML 注入 <base>：`a.href` 这类 reflected 属性必须按站点域名解析，
  // 否则相对地址被解析成 localhost，id 提取与 postView 全部错乱（详见 parseHTML 注释）
  const doc = parseHTML(html, url.href)
  const results = [...doc.querySelectorAll('.box_thumbs .box_thumb')].map(async el => {
    const a = el.querySelector('a')
    const img = el.querySelector<HTMLElement>('[data-bg]')
    const id = a!.href.match(/(\d+)/)?.[1]

    const previewUrl = img!.getAttribute('data-bg')
    // web 版：经代理量尺寸，规避防盗链
    const { width, height } = await getImageSize(toProxyImgUrl(previewUrl) || previewUrl || '')

    return {
      id,
      postView: a!.href,
      previewUrl,
      fileUrl: '',
      tags: [],
      width: Number(width),
      height: Number(height),
      aspectRatio: Number(width) / Number(height),
      fileExt: 'jpg',
      fileDownloadName: `kusowanka_${id}`,
      rating: '',
    } as any
  })
  return Promise.all(results)
}

export async function getKusowankaDetail(id: string) {
  const html = await apiFetch(`https://kusowanka.com/post/${id}/`)
  const doc = parseHTML(html, `https://kusowanka.com/post/${id}/`)
  return {
    fileUrl: doc.querySelector<HTMLImageElement>('.post_image img')?.getAttribute('data-src'),
    tags: [
      ...[...doc.querySelectorAll<HTMLElement>('.parodies_list a')].map(e => e.innerText),
      ...[...doc.querySelectorAll<HTMLElement>('.characters_list a')].map(e => e.innerText),
      ...[...doc.querySelectorAll<HTMLElement>('.artists_list a')].map(e => e.innerText),
      ...[...doc.querySelectorAll<HTMLElement>('.metadatas_list a')].map(e => e.innerText),
      ...[...doc.querySelectorAll<HTMLElement>('.tags_list a')].map(e => e.innerText),
    ],
  }
}

export const kusowanka = {
  is: isKusowankaPage,
  posts: fetchKusowankaPosts,
  detail: getKusowankaDetail,
}
