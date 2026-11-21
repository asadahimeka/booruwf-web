/**
 * GET /proxy?url=<encoded>
 *
 * API / HTML 通用转发：按 per-site 规则伪装 header 后透传上游响应。
 * 响应体不落盘、不缓存；Content-Type 原样透传，前端 DOMParser/JSON 解析不受影响。
 *
 * 轻量人机校验应答：zerochan 等站点对无 cookie 会话返回 503 + 挑战页，
 * 挑战页靠加载一张内嵌 SVG 让服务端下发 xbotcheck cookie（与 JS 无关的纯
 * HTTP 往返）。这里检测到挑战时自动请求该 SVG 拿 cookie，再带 cookie 重试
 * 原始请求，对前端完全透明。
 */
import type { Context } from 'hono'
import { isAllowedDomain, isClaimedDomain, resolveRule } from './sites.ts'
import { upstreamFetch } from './runtime.ts'
import type { SiteRule } from './sites.ts'

/** 简单内存缓存：仅缓存小体积 JSON/文本响应，图片一律不走这里 */
const cache = new Map<string, { status: number; headers: Headers; body: ArrayBuffer; ts: number }>()
const CACHE_TTL = 60_000
const CACHE_MAX = 64
const CACHE_MAX_BODY = 512 * 1024

export async function proxyHandler(c: Context) {
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
  if (rule.headers) for (const [k, v] of Object.entries(rule.headers)) headers.set(k, v)
  // 透传前端需要的安全头以外的部分（cookie 一律不透传：登录态功能不做）
  const accept = c.req.header('accept')
  if (accept) headers.set('accept', accept)
  // 自部署 szurubooru 等需要认证的站点：前端把 Token base64 放在 Authorization 里
  const authorization = c.req.header('authorization')
  if (authorization) headers.set('authorization', authorization)

  // POST 转发（如 hentaiclub 的站内搜索）：透传请求体与 content-type；缓存只针对 GET
  const isPost = c.req.method === 'POST'

  // Range 透传：nozomi 的 116MB .nozomi 索引靠 Range 分页拉取；
  // 上游返回 206 时 content-range 一并带回，前端按需切片
  const range = c.req.header('range')
  if (range && !isPost) headers.set('range', range)

  const reqBody = isPost ? await c.req.arrayBuffer() : undefined
  if (isPost && c.req.header('content-type')) headers.set('content-type', c.req.header('content-type')!)

  const cacheKey = url.toString()
  const cached = !isPost ? cache.get(cacheKey) : undefined
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    cached.headers.set('x-cache-hit', 'true')
    return respondWith(cached.status, cached.headers, cached.body)
  }

  let upstream: Response
  try {
    upstream = await upstreamFetch(url, {
      method: isPost ? 'POST' : 'GET',
      headers,
      body: reqBody,
      redirect: rule.redirect ?? 'follow',
    })
  } catch (e) {
    // 上游不可达（DNS/连接超时/TLS 失败等）：返回 502 而不是让异常冒泡到 hono
    return c.json({ error: `upstream fetch failed: ${((e as Error)?.cause as { code?: string } | undefined)?.code ?? (e as Error)?.message ?? e}` }, 502)
  }

  // 503 可能是轻量人机校验挑战页：尝试自动应答（拉 SVG 下发 cookie 后重试）
  if (upstream.status === 503) {
    const challengeBody = await upstream.arrayBuffer()
    const solved = await trySolveChallenge(rule, url, headers, challengeBody)
    if (solved) {
      upstream = solved
    } else {
      // 原始 body 已消费，重建一个等价 Response 交给后续缓存/透传逻辑
      upstream = new Response(challengeBody, { status: upstream.status, headers: upstream.headers })
    }
  }

  const resHeaders = new Headers()
  // content-length 一律不透传：fetch 通道会自动解压（上游的 length 是 gzip 尺寸），
  // curl 通道的重定向链也常与最终 body 不一致；透传出去客户端会按旧值截断响应。
  // Range 分页依赖的 content-range 保留（它描述的是字节区间，与编码无关）
  for (const key of ['content-type', 'last-modified', 'etag', 'content-range']) {
    const v = upstream.headers.get(key)
    if (v) resHeaders.set(key, v)
  }
  resHeaders.set('cache-control', 'no-store')

  // 小响应（JSON/HTML/XML）走内存缓存；大响应直接透传已缓冲的 body。
  // 非 2xx 不缓存（挑战页 / 上游临时错误，缓存住会遮蔽后续恢复）
  const contentType = upstream.headers.get('content-type') || ''
  const isCacheable = upstream.status >= 200 && upstream.status < 300
    && /^(application\/(json|xml|atom\+xml)|text\/(html|xml))/.test(contentType)
  if (isCacheable) {
    const body = await upstream.arrayBuffer()
    if (body.byteLength <= CACHE_MAX_BODY) {
      cache.set(cacheKey, { status: upstream.status, headers: resHeaders, body, ts: Date.now() })
      if (cache.size > CACHE_MAX) {
        const oldest = cache.keys().next().value
        if (oldest) cache.delete(oldest)
      }
    }
    // 注意：此处 body 已经 arrayBuffer() 缓冲，绝不能再回退到 upstream.body
    // （流已锁定，会抛 "body disturbed or locked"）；超缓存上限的大响应
    // 直接透传缓冲体，不进缓存即可
    return respondWith(upstream.status, resHeaders, body)
  }

  return new Response(upstream.body, { status: upstream.status, headers: resHeaders })
}

function respondWith(status: number, headers: Headers, body: ArrayBuffer | null) {
  // 注意：不用 c.body() —— hono 的 Context.body 对 Headers 实例支持不佳，直接构造 Response
  return new Response(body, { status, headers })
}

/** zerochan 风格挑战页的内嵌校验资源（服务端借此下发 xbotcheck cookie） */
const CHALLENGE_SVG_RE = /totally-innocent-logo-image\.svg\?[^"'()\s]+/

function collectSetCookies(headers: Headers): string[] {
  return (headers as any).getSetCookie?.() ?? []
}

function headersWithCookies(base: Headers, cookies: string[]): Headers {
  const merged = new Headers(base)
  if (cookies.length) merged.set('cookie', cookies.join('; '))
  return merged
}

/**
 * 尝试解开 503 挑战页：从缓冲的挑战页 body 里提取校验资源地址，
 * 请求它收集 Set-Cookie，再带 cookie 重试原始请求。
 * 不匹配挑战形态时返回 null（调用方回退为透传原始响应）。
 */
async function trySolveChallenge(
  rule: SiteRule,
  url: URL,
  headers: Headers,
  challengeBody: ArrayBuffer,
): Promise<Response | null> {
  const text = new TextDecoder().decode(challengeBody.slice(0, 4096))
  const match = text.match(CHALLENGE_SVG_RE)
  if (!match) return null

  try {
    const svgUrl = new URL(`/${match[0]}`, url)
    const svgResp = await upstreamFetch(svgUrl, {
      method: 'GET',
      headers: headersWithCookies(headers, []),
      redirect: 'follow',
    })
    await svgResp.arrayBuffer() // 消费 body，确保连接复用语义一致
    const retry = await upstreamFetch(url, {
      method: 'GET',
      headers: headersWithCookies(headers, collectSetCookies(svgResp.headers)),
      redirect: rule.redirect ?? 'follow',
    })
    return retry
  } catch {
    return null
  }
}
