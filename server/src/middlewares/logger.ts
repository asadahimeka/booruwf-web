/**
 * 请求日志中间件：耗时（X-Response-Time 头）+ 方法/状态/URL/UA/来源一行打印。
 */
import type { MiddlewareHandler } from 'hono'
import { sanitizeUrl } from '../lib/sanitize.ts'

export function logger(): MiddlewareHandler {
  return async (ctx, next) => {
    const start = new Date()
    await next()
    const time = `${Date.now() - start.valueOf()}ms`
    ctx.res.headers.set('X-Response-Time', time)
    // URL 走脱敏打印（上游 URL 可能带 token/key 类 query）
    console.log(start.toLocaleString('zh'), ctx.req.method, ctx.res.status, time, sanitizeUrl(ctx.req.url).slice(0, 150), ctx.req.header('User-Agent'), ctx.req.header('Origin'), ctx.req.header('Referer'))
  }
}
