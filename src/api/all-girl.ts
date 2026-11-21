import { apiFetch, parseHTML, toProxyImgUrl } from './gateway'
import { getImageSize } from '@/utils'
import { siteContext } from '@/site-context'

export function isAllGirlPage() {
  return siteContext.host == 'allgirl.booru.org'
}

export async function fetchAllGirlPosts(page: number, tags: string | null) {
  const url = new URL('https://allgirl.booru.org/index.php')
  url.searchParams.set('page', 'post')
  url.searchParams.set('s', 'list')
  url.searchParams.set('pid', `${(page - 1) * 20}`)
  tags && url.searchParams.set('tags', tags)
  const html = await apiFetch(url.href)
  // parseHTML 注入 <base>，reflected 属性（img.src / a.href）按站点域名解析
  const doc = parseHTML(html, url.href)
  const results = [...doc.querySelectorAll('.content .thumb')].map(async el => {
    const a = el.querySelector('a')
    const img = el.querySelector('img')
    const id = a!.getAttribute('id')?.slice(1)

    const previewUrl = img!.src
    // web 版：经代理量尺寸，规避防盗链
    const { width, height } = await getImageSize(toProxyImgUrl(previewUrl) || previewUrl)
    const tags = img!.title.split(/\s/).filter(Boolean)

    return {
      id,
      postView: a!.href,
      previewUrl,
      fileUrl: '',
      tags,
      width: Number(width),
      height: Number(height),
      aspectRatio: Number(width) / Number(height),
      fileExt: 'jpg',
      fileDownloadName: `allgirl ${id} ${tags.join(' ')}`,
      rating: img!.title.includes('rating:Safe') ? 's' : 'e',
    } as any
  })
  return Promise.all(results)
}

export async function getAllGirlDetail(id: string) {
  const html = await apiFetch(`https://allgirl.booru.org/index.php?page=post&s=view&id=${id}`)
  const doc = parseHTML(html, `https://allgirl.booru.org/index.php?page=post&s=view&id=${id}`)
  return {
    fileUrl: doc.querySelector<HTMLImageElement>('#image')?.src,
  }
}

export const allgirl = {
  is: isAllGirlPage,
  posts: fetchAllGirlPosts,
  detail: getAllGirlDetail,
}
