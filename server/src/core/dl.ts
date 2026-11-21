/**
 * GET /dl?url=<encoded>&name=<filename>
 *
 * 下载代理：带 Content-Disposition 返回附件，解决跨域 <a download> 失效问题。
 */
import type { Context } from 'hono'
import { isAllowedDomain, isClaimedDomain, resolveRule } from './sites.ts'
import { upstreamFetch } from './runtime.ts'

export async function dlHandler(c: Context) {
  const target = c.req.query('url')
  if (!target) return c.json({ error: 'missing url param' }, 400)

  const url = new URL(target)
  if (!/^https?:$/.test(url.protocol)) return c.json({ error: 'invalid protocol' }, 400)
  if (!isAllowedDomain(url) && !isClaimedDomain(url, c.req.query('claim')))
    return c.json({ error: `domain not allowed: ${url.hostname}` }, 403)

  const rule = resolveRule(url)
  const headers = new Headers()
  headers.set('user-agent', rule.ua!)
  if (rule.referer) headers.set('referer', rule.referer)

  const upstream = await upstreamFetch(url, { headers, redirect: 'follow' })
  if (!upstream.ok) {
    return c.json({ error: `upstream ${upstream.status}` }, 502)
  }

  const rawName = c.req.query('name') || url.pathname.split('/').pop() || 'file'
  const safeName = rawName.replace(/[\r\n"\\/]/g, '_')

  const resHeaders = new Headers()
  const contentType = upstream.headers.get('content-type')
  if (contentType) resHeaders.set('content-type', contentType)
  // content-length 只在无压缩编码时透传：fetch 通道会自动解压，上游 length 是
  // 压缩后尺寸，透传会让客户端按旧值截断（与 /proxy、/img 同源的坑）
  const length = upstream.headers.get('content-encoding')
    ? null
    : upstream.headers.get('content-length')
  if (length) resHeaders.set('content-length', length)
  resHeaders.set('content-disposition', `attachment; filename*=UTF-8''${encodeURIComponent(safeName)}`)
  resHeaders.set('cache-control', 'no-store')

  return new Response(upstream.body, { status: 200, headers: resHeaders })
}
