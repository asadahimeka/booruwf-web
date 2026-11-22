/**
 * 固定窗口 IP 限流（移植自 pxve-api src/middlewares/rate-limit.ts）。
 *
 * 公网部署时 /proxy /img /dl 可被脚本滥用打爆上游；这里按客户端 IP 做固定
 * 窗口计数，超限返回 429 + Retry-After。存储为内存 Map，带过期清理与容量
 * 上限（STORE_MAX），不会随 IP 数无限增长。
 *
 * 客户端 IP 解析顺序（resolveClientIp）：
 * 1. TRUST_CLOUDFLARE=true → cf-connecting-ip 头
 * 2. TRUST_PROXY=true → x-real-ip / x-forwarded-for 最右段（由自家反代追加，
 *    客户端无法污染；最左段可伪造，不能用）
 * 3. 运行时连接信息（entry 注入的 getConnInfo）
 *
 * 回环地址（127.0.0.1/::1）豁免：本地 dev、smoke、e2e 流量不应被限流，
 * 滥用面只存在于公网。
 *
 * 环境变量：RATE_LIMIT_ENABLED（默认开）、RATE_LIMIT_WINDOW_MS（默认 60000）、
 * RATE_LIMIT_MAX（默认 120）
 */
import type { Context, MiddlewareHandler } from 'hono'

const STORE_MAX = 5000

const store = new Map<string, { count: number; resetAt: number }>()

function cleanupStore(now: number): void {
  if (store.size === 0) return
  // 先清过期条目；仍超上限则按 resetAt 淘汰最旧的
  for (const [key, entry] of store) {
    if (now > entry.resetAt) {
      store.delete(key)
    }
  }
  if (store.size > STORE_MAX) {
    const entries = [...store.entries()].sort((a, b) => a[1].resetAt - b[1].resetAt)
    const toRemove = entries.slice(0, store.size - STORE_MAX)
    for (const [key] of toRemove) {
      store.delete(key)
    }
  }
}

/** 回环地址（含 IPv4-mapped 形态） */
export function isLoopbackIp(ip: string | undefined): boolean {
  if (!ip) return false
  return ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1' || ip === 'localhost'
}

/**
 * 客户端 IP 解析。connInfo 由各运行时 entry 注入（hono 各适配器的
 * getConnInfo），core 层不做运行时探测。
 */
export function resolveClientIp(c: Context, connInfo?: (c: Context) => string | undefined): string {
  if (process.env.TRUST_CLOUDFLARE === 'true') {
    return c.req.header('cf-connecting-ip') || 'unknown'
  }

  // 代理头仅在部署于自家反代之后时才可信任，否则客户端可伪造绕过限流
  if (process.env.TRUST_PROXY === 'true') {
    const realIP = c.req.header('x-real-ip')
    if (realIP) return realIP

    const xff = c.req.header('x-forwarded-for')
    if (xff) {
      // 取最右段（由自家代理追加，客户端无法污染）；最左段可被客户端伪造
      const rightmost = xff.split(',').pop()?.trim()
      if (rightmost) return rightmost
    }
  }

  try {
    return connInfo?.(c) || 'unknown'
  } catch {
    return 'unknown'
  }
}

export function rateLimit(getClientIp: (c: Context) => string): MiddlewareHandler {
  const windowMs = Number(process.env.RATE_LIMIT_WINDOW_MS ?? 60000)
  const max = Number(process.env.RATE_LIMIT_MAX ?? 120)
  const enabled = (process.env.RATE_LIMIT_ENABLED ?? '1') !== '0'

  return async (c, next) => {
    if (!enabled) return next()
    const ip = getClientIp(c)
    if (isLoopbackIp(ip)) return next()

    const now = Date.now()
    cleanupStore(now)
    const e = store.get(ip)
    if (!e || now > e.resetAt) {
      store.set(ip, { count: 1, resetAt: now + windowMs })
      return next()
    }
    e.count++
    if (e.count > max) {
      return c.json({ error: 'Rate limit exceeded' }, 429, {
        'Retry-After': String(Math.ceil((e.resetAt - now) / 1000)),
      })
    }
    return next()
  }
}
