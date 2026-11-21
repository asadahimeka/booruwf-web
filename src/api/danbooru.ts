import type { Post } from '@himeka/booru'
import i18n from '@/utils/i18n'
import { siteContext } from '@/site-context'

/**
 * danbooru 适配器。自脚本版移植：
 * - `location.hostname` → `siteContext.host`
 * - addFavoriteDanbooru（登录态）不迁移
 */

export function isDanbooruPage() {
  return siteContext.host == 'danbooru.donmai.us'
}

const isCNLang = i18n.locale.includes('zh')
const tagSortOrder = ['artist', 'copyright', 'character', 'general']
export function getDanbooruTagDetail(image: Post) {
  // @ts-expect-error data protected
  const { data, tags } = image
  const tagMap: Record<string, [any, string, string[]]> = {
    artist: [i18n.t('Ym0HIEu9Q80qXB31LuC6c'), '#FB8C00', data.tag_string_artist.split(/\s+/)],
    copyright: [i18n.t('juT6gwLOg5r1h2vFpFf6P'), '#AB47BC', data.tag_string_copyright.split(/\s+/)],
    character: [i18n.t('aonlPAu9kEkkwNvQg0DBk'), '#66BB6A', data.tag_string_character.split(/\s+/)],
  }
  const tagsCN = window.__tagsCNSpace
  return {
    voted: false,
    tags: tags.map(tag => {
      const tagCN = isCNLang && tagsCN?.[tag.replace(/_/g, ' ')]
      const typedTag = { type: '', text: '', color: '' }
      for (const [key, val] of Object.entries(tagMap)) {
        if (val[2].includes(tag)) {
          typedTag.type = key
          typedTag.text = val[0]
          typedTag.color = val[1]
          break
        }
      }
      const tagText = [
        typedTag.text && `[ ${typedTag.text} ] `,
        tag,
        tagCN && ` [ ${tagCN} ]`,
      ].filter(Boolean).join('')
      return {
        tag,
        tagText,
        color: typedTag.color || '#8F77B5',
        type: typedTag.type || 'general',
      }
    }).sort((a, b) => {
      return tagSortOrder.indexOf(a.type) - tagSortOrder.indexOf(b.type)
    }),
  }
}
