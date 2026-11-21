import { fetchSankakuComplexPosts, getSankakuComplexDetail, isSankakuComplexPage } from './sankaku-complex'
import { fetchSankakuIdolPosts, getSankakuIdolDetail, isSankakuIdolPage } from './sankaku-idol'
import { apiFetch } from './gateway'
import { siteContext } from '@/site-context'

export const isSankakuSite = siteContext.host.includes('sankaku') || siteContext.host.includes('idolcomplex')

export function isSankakuPage() {
  return siteContext.host == 'sankaku.app' || siteContext.host == 'www.sankakucomplex.com'
}

const pageState: { next: string | null } = { next: null }
export async function fetchSankakuPosts(page: number, tags: string | null) {
  if (page == 1) pageState.next = null
  const url = new URL('https://sankakuapi.com/v2/posts/keyset')
  url.searchParams.set('lang', navigator.language || 'zh-CN')
  url.searchParams.set('default_threshold', '1')
  url.searchParams.set('hide_posts_in_books', 'in-larger-tags')
  url.searchParams.set('limit', '40')
  url.searchParams.set('page', `${page}`)
  pageState.next && url.searchParams.set('next', `${pageState.next}`)
  tags && url.searchParams.set('tags', tags)
  // api-version 等自定义头由服务端规则表声明（/proxy 不透传前端自定义头）
  const json = JSON.parse(await apiFetch(url.href))
  pageState.next = json.meta.next
  return json.data.filter((e: any) => e.preview_url).map((e: any) => {
    const fileExt = e.file_ext
    return {
      id: e.id,
      postView: `https://sankaku.app/posts/${e.id}`,
      previewUrl: e.preview_url,
      fileUrl: '',
      tags: e.tags.map((t: any) => t.name + (t.name_ja ? `[${t.name_ja}]` : '')),
      width: e.width,
      height: e.height,
      aspectRatio: e.width / e.height,
      fileExt,
      fileDownloadName: `sankaku ${e.id} ${e.tags.join(' ')}.${fileExt}`,
      fileDownloadText: `${e.width}×${e.height} [${(e.file_size / 1000).toFixed(0)} kB] ${fileExt.toUpperCase()}`,
      rating: e.rating,
      createdAt: e.created_at.s * 1000,
    } as any
  })
}

export async function getSankakuDetail(id: string) {
  const json = JSON.parse(await apiFetch(`https://sankakuapi.com/posts/${id}/fu?lang=${navigator.language || 'zh-CN'}`))
  return {
    sampleUrl: json.data.sample_url,
    fileUrl: json.data.file_url,
  }
}

export const sankaku = {
  is: isSankakuPage,
  posts: fetchSankakuPosts,
  detail: getSankakuDetail,
  idol: {
    is: isSankakuIdolPage,
    posts: fetchSankakuIdolPosts,
    detail: getSankakuIdolDetail,
  },
  complex: {
    is: isSankakuComplexPage,
    posts: fetchSankakuComplexPosts,
    detail: getSankakuComplexDetail,
  },
}
