import { apiFetch } from './gateway'
import i18n from '@/utils/i18n'
import { siteContext } from '@/site-context'

export function isEshuushuuPage() {
  return siteContext.host == 'e-shuushuu.net'
}

function extract(allData: any[]) {
  const images = []

  for (let i = 2; i < allData.length; i++) {
    const schema = allData[i]

    if (typeof schema !== 'object' || schema === null || Array.isArray(schema)) continue
    if (!schema.image_id) continue

    const img: Record<string, any> = {}

    for (const [fieldName, fieldIdx] of Object.entries(schema as Record<string, any>)) {
      const val = allData[fieldIdx]
      if (val === undefined) continue

      if (fieldName === 'tags' && Array.isArray(val)) {
        const tags = []
        for (const tagIdx of val) {
          const tagData = allData[tagIdx]
          if (tagData && typeof tagData === 'object' && tagData.tag_id) {
            tags.push({
              id: tagData.tag_id,
              name: allData[tagData.title],
              type_id: allData[tagData.type],
              type_name: allData[tagData.type_name],
            })
          }
        }
        img[fieldName] = tags
      } else if (fieldName === 'user' && typeof val === 'object' && val.user_id !== undefined) {
        img.user = {
          user_id: allData[val.user_id],
          username: allData[val.username],
          avatar: allData[val.avatar],
          user_title: allData[val.user_title],
          avatar_url: allData[val.avatar_url],
        }
      } else {
        img[fieldName] = val
      }
    }

    if (img.image_id) {
      images.push(img)
    }
  }

  return images
}

export async function fetchEshuushuuPosts(page: number, tags: string | null) {
  const url = new URL('https://e-shuushuu.net/__data.json')
  url.searchParams.set('page', `${page}`)
  if (tags) {
    const match = tags.match(/[\w\s]+#(\d+)/)
    if (match?.[1]) url.searchParams.set('tags', match[1])
  }

  const json = JSON.parse(await apiFetch(url.href))

  const results = extract(json.nodes[1].data).map(img => {
    const id = img.image_id
    const fileExt = img.ext
    const width = img.width
    const height = img.height
    const tags = (img.tags || []).map((e: any) => e.name)

    return {
      id,
      postView: `https://e-shuushuu.net/images/${id}`,
      previewUrl: img.thumbnail_url,
      fileUrl: img.url,
      tags,
      _tags: img.tags,
      width,
      height,
      aspectRatio: width / height,
      fileExt,
      fileDownloadName: `e-shuushuu ${id} ${tags.join(' ')}.${fileExt}`,
      fileDownloadText: `${width}×${height} [${(img.filesize / 1024 / 1024).toFixed(2)} MB] ${fileExt?.toUpperCase()}`,
      rating: '',
      createdAt: new Date(img.date_added),
    } as any
  })

  return results
}

const isCNLang = i18n.locale.includes('zh')
const tagSortOrder = ['artist', 'copyright', 'character', 'general']
const tagMap: Record<string, any[]> = {
  Artist: [i18n.t('Ym0HIEu9Q80qXB31LuC6c'), '#FB8C00', 'artist'],
  Source: [i18n.t('juT6gwLOg5r1h2vFpFf6P'), '#AB47BC', 'copyright'],
  Character: [i18n.t('aonlPAu9kEkkwNvQg0DBk'), '#66BB6A', 'character'],
}
export function getTagDetail(image: Record<string, any>) {
  const tags: any[] = image._tags
  return {
    voted: false,
    tags: tags.map(tag => {
      const tagCN = isCNLang && window.__tagsCNSpace?.[tag.name.replace(/_/g, ' ')]
      const tagType = tagMap[tag.type_name]

      const tagText = [
        tagType?.[0] && `[ ${tagType[0]} ] `,
        tag.name,
        tagCN && ` [ ${tagCN} ]`,
      ].filter(Boolean).join('')

      return {
        tag: tag.name,
        tagText,
        color: tagType?.[1] || '#8F77B5',
        type: tagType?.[2] || 'general',
      }
    }).sort((a, b) => {
      return tagSortOrder.indexOf(a.type) - tagSortOrder.indexOf(b.type)
    }),
  }
}

export const eshuushuu = {
  is: isEshuushuuPage,
  posts: fetchEshuushuuPosts,
  tagDetail: getTagDetail,
}
