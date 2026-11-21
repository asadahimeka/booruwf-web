/**
 * GET /img?url=<encoded>
 *
 * 图片/视频代理：按站点规则伪装 Referer/UA 解决防盗链，流式转发不落盘。
 * 透传 Range / Content-Range（视频拖动进度条依赖 ranged request）。
 */
import type { Context } from 'hono'
import { isAllowedImageDomain, isClaimedDomain, resolveRule } from './sites.ts'
import { upstreamFetch } from './runtime.ts'

export async function imgHandler(c: Context) {
  const target = c.req.query('url')
  if (!target) return c.json({ error: 'missing url param' }, 400)

  const url = new URL(target)
  if (!/^https?:$/.test(url.protocol)) return c.json({ error: 'invalid protocol' }, 400)
  // claim 供 IMG_ALLOW_ANY_HOST=0（纯白名单模式）时放行用户配置的自定义站点域
  if (!isAllowedImageDomain(url) && !isClaimedDomain(url, c.req.query('claim')))
    return c.json({ error: `domain not allowed: ${url.hostname}` }, 403)

  const rule = resolveRule(url)
  const headers = new Headers()
  headers.set('user-agent', rule.ua!)
  if (rule.referer) headers.set('referer', rule.referer)
  if (rule.headers) for (const [k, v] of Object.entries(rule.headers)) headers.set(k, v)
  // ranged request 透传（视频 seek）
  const range = c.req.header('range')
  if (range) headers.set('range', range)

  let upstream: Response
  try {
    upstream = await upstreamFetch(url, { headers, redirect: 'follow' })
  } catch (e) {
    // 图片端点对 <img>/<video> 返回 502 时浏览器只会显示加载失败，不会白屏
    return c.json({ error: `upstream fetch failed: ${((e as Error)?.cause as { code?: string } | undefined)?.code ?? (e as Error)?.message ?? e}` }, 502)
  }

  const resHeaders = new Headers()
  // content-length 只在无压缩编码时透传：fetch 通道会自动解压（上游的 length
  // 是压缩后尺寸），透传出去客户端会按旧值截断响应（与 /proxy 同源的坑）
  const hasEncoding = Boolean(upstream.headers.get('content-encoding'))
  for (const key of [
    'content-type',
    'content-range',
    'accept-ranges',
    'etag',
    'last-modified',
  ]) {
    const v = upstream.headers.get(key)
    if (v) resHeaders.set(key, v)
  }
  if (!hasEncoding) {
    const v = upstream.headers.get('content-length')
    if (v) resHeaders.set('content-length', v)
  }
  // 浏览器侧强缓存（服务端不做二级缓存，图片流量大不落盘）。
  // 只有真实媒体响应才允许长缓存：上游的 403 挑战页 / 防盗链 HTML 一旦被缓存 86400s，
  // 即使上游恢复，用户仍会持续看到破图（只能强刷或清缓存）。
  const contentType = upstream.headers.get('content-type') || ''
  const isMedia = /^(image|video|audio)\//.test(contentType)
  resHeaders.set('cache-control', isMedia && upstream.ok ? 'public, max-age=86400' : 'no-store')

  return new Response(upstream.body, { status: upstream.status, headers: resHeaders })
}
