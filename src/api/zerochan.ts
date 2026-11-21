import { apiFetch } from './gateway'
import { siteContext } from '@/site-context'

export function isZerochanPage() {
  return siteContext.host.includes('zerochan.net')
}

const ZEROCHAN_ORIGIN = 'https://www.zerochan.net'

/**
 * 503 人机校验挑战已由服务端 /proxy 自动应答（拉挑战页内嵌 SVG 下发
 * xbotcheck cookie 后重试，见 server/src/core/proxy.ts trySolveChallenge），
 * 前端无感知。列表 JSON 接口会返回 500 + 合法 body 的怪癖，用 tolerant 容忍
 * （与脚本版不检查状态码的行为一致）。
 */
async function requestZerochan(url: string) {
  return apiFetch(url, { tolerant: true })
}

// 线上列表接口会把合法 JSON 包在一个多余的 "{" 和整页 HTML 里，按花括号配对截出真正的对象
export function extractJsonPayload(text: string): string {
  const trimmed = text.trimStart()
  const body = /^\{\s*(?=\{)/.test(trimmed) ? trimmed.replace(/^\{\s*/, '') : trimmed
  let depth = 0
  let inString = false
  let escaped = false
  for (let i = 0; i < body.length; i++) {
    const char = body[i]
    if (escaped) {
      escaped = false
      continue
    }
    if (char === '\\') {
      escaped = true
      continue
    }
    if (char === '"') {
      inString = !inString
      continue
    }
    if (inString) {
      continue
    }
    if (char === '{') {
      depth++
    } else if (char === '}') {
      depth--
      if (depth === 0) {
        return body.slice(0, i + 1)
      }
    }
  }
  return body
}

export async function fetchZerochanPosts(page: number, tags: string | null) {
  const raw = await requestZerochan(`${ZEROCHAN_ORIGIN}/${tags || ''}?p=${page}&json`)
  let json: any
  try {
    json = JSON.parse(extractJsonPayload(raw))
  } catch {
    throw new Error(
      `zerochan JSON endpoint returned a broken response: ${raw.slice(0, 120)}`,
    )
  }
  if (!Array.isArray(json.items)) {
    throw new TypeError(
      `zerochan JSON endpoint returned no items: ${raw.slice(0, 120)}`,
    )
  }
  return json.items.map((e: any) => {
    const primary = escape(e.tag.replace(/\s/g, '.'))
    return {
      id: e.id,
      postView: `https://www.zerochan.net/${e.id}`,
      previewUrl: e.thumbnail,
      sampleUrl: `https://s1.zerochan.net/${primary}.600.${e.id}.jpg`,
      fileUrl: `https://static.zerochan.net/${primary}.full.${e.id}.png`,
      tags: e.tags,
      width: e.width,
      height: e.height,
      aspectRatio: e.width / e.height,
      fileExt: 'jpg',
      fileDownloadName: `zerochan ${e.id} ${e.tags.join(' ')}`,
      fileDownloadText: `${e.width}×${e.height}`,
      rating: '',
      sourceUrl: e.source,
    } as any
  })
}

export async function getZerochanFileUrl(id: string) {
  const raw = await requestZerochan(`${ZEROCHAN_ORIGIN}/${id}?json`)
  const json = JSON.parse(extractJsonPayload(raw))
  return json.full
}

export const zerochan = {
  is: isZerochanPage,
  posts: fetchZerochanPosts,
}
