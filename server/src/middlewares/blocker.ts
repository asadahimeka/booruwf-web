/**
 * 网关请求拦截（移植自 pxve-api src/middlewares/blocker.ts）。
 *
 * 只挂在 /proxy /img /dl 三个代理端点（静态托管与 PWA 资源不拦）：
 * - UA 黑名单 + isbot 爬虫识别：挡自动化脚本扫代理（pxve-api 正是遭脚本
 *   异常调用导致上游账号被封才停维护的，见其 ABUSE.md）
 * - Origin / Referer 白名单：挡第三方页面直接嵌用本网关资源
 *
 * 环境变量：
 * - ACCEPT_DOMAINS：逗号分隔的来源域白名单（支持 *.example.com 通配），
 *   为空则不校验来源（本地/内网部署默认形态）
 * - UA_BLACKLIST：逗号分隔的额外 UA 关键词黑名单
 *
 * 回环请求（127.0.0.1/::1）豁免：dev / smoke / e2e 的请求不带浏览器
 * Origin，不应被拦。
 */
import type { Context, MiddlewareHandler } from 'hono'
import { isbot } from 'isbot'
import { isLoopbackIp } from './rate-limit.ts'

function commaList(name: string): string[] {
  return process.env[name]?.split(',').map(s => s.trim()).filter(Boolean) ?? []
}

/**
 * 精确来源匹配：完整 hostname 相等，或 *.domain 通配后缀。
 * ACCEPT_DOMAINS 为空时回退为允许所有来源。
 */
export function isAllowedOrigin(origin: string): boolean {
  const list = commaList('ACCEPT_DOMAINS')
  if (!list.length) return true
  try {
    const h = new URL(origin).hostname
    return list.some(d => (d.startsWith('*.') ? h === d.slice(2) || h.endsWith(d.slice(1)) : h === d))
  } catch {
    return false
  }
}

function isAccepted(ua?: string, origin?: string, referer?: string): boolean {
  if (!ua) return false
  if (isbot(ua)) return false

  const uaLower = ua.toLowerCase()
  if (commaList('UA_BLACKLIST').some(e => uaLower.includes(e.toLowerCase()))) {
    return false
  }

  const originOk = !origin || isAllowedOrigin(origin)
  const refererOk = !referer || isAllowedOrigin(referer)

  return originOk && refererOk
}

export function blocker(getClientIp: (c: Context) => string): MiddlewareHandler {
  return async (c, next) => {
    if (isLoopbackIp(getClientIp(c))) return next()

    const ua = c.req.header('User-Agent')
    const origin = c.req.header('Origin')
    const referer = c.req.header('Referer')

    if (isAccepted(ua, origin, referer)) {
      await next()
      return
    }

    return c.json({ error: 'Forbidden' }, 403)
  }
}
