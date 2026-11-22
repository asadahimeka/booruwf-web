/**
 * Hono 服务端核心：静态托管 + 代理网关。
 *
 * 三运行时兼容约定：
 * - 本文件只用 Web 标准 API（fetch / Request / Response / URL / streams）
 * - serveStatic 的实现与 dist 路径解析按运行时差异由各 entry 注入
 *   （见 entry/node.ts / bun.ts / deno.ts）
 * - 缓存为内存级（Map + TTL），不落盘
 */
import type { Context } from 'hono'
import { Hono } from 'hono'
import { secureHeaders } from 'hono/secure-headers'
import { blocker } from '../middlewares/blocker.ts'
import { dlHandler } from '../handlers/dl.ts'
import { imgHandler } from '../handlers/img.ts'
import { logger } from '../middlewares/logger.ts'
import { rateLimit, resolveClientIp } from '../middlewares/rate-limit.ts'
import { proxyHandler } from '../handlers/proxy.ts'
import { loadDotEnv } from '../lib/env.ts'
import { toPublicError } from '../lib/sanitize.ts'

// 加载 server/.env（Bun/Deno 自动加载，这里补 Node；不覆盖已有变量）
loadDotEnv()

export const PORT = Number(process.env.PORT || 8787)

export interface AppOptions {
  /** 各运行时对应的 serveStatic 实现 */
  serveStatic: (options: { root: string; rewriteRequestPath?: (p: string) => string }) => any
  /** dist 目录（entry 内解析为「相对当前 cwd 的路径」，如 '../dist'） */
  distRoot: string
  /**
   * 各运行时注入的连接来源 IP 解析（hono 各适配器的 getConnInfo）。
   * 限流与拦截中间件用它识别回环流量（豁免）与公网客户端（计数）。
   */
  getClientIp?: (c: Context) => string | undefined
}

export function createApp({ serveStatic, distRoot, getClientIp: connInfo }: AppOptions) {
  const app = new Hono()

  // 客户端 IP：先走 TRUST_* 代理头，再回退到运行时连接信息
  const clientIp = (c: Context) => resolveClientIp(c, connInfo)

  app.use('*', logger())

  // 限流挂在所有路由（回环豁免，公网按 IP 计数）
  app.use('*', rateLimit(clientIp))
  app.use(secureHeaders({ crossOriginResourcePolicy: 'same-site' }))

  // 内部异常统一兜底：细节只进日志，对外仅返回 requestId
  app.onError((err, c) => c.json(toPublicError(err), 500))

  // --- 代理网关（先于静态路由注册，避免被 SPA fallback 吞掉） ---
  // blocker 只挂代理端点：UA 黑名单 / isbot / Origin-Referer 白名单
  const guard = blocker(clientIp)
  app.get('/proxy/*', guard, proxyHandler)
  app.post('/proxy/*', guard, proxyHandler) // hentaiclub 等站点搜索用 POST
  app.get('/img/*', guard, imgHandler)
  app.get('/dl/*', guard, dlHandler)

  // --- 健康检查 ---
  app.get('/healthz', c => c.json({ ok: true, ts: Date.now() }))

  // --- 静态资源缓存头 ---
  // 哈希资源（assets/*）长缓存 immutable；index.html / sw.js / manifest.json
  // 必须 no-cache，否则 PWA 更新会卡死（复刻原 vercel.json 的 SW 头规则）
  app.use('*', async (c, next) => {
    await next()
    const path = c.req.path
    if (
      path.startsWith('/assets/')
      || path.startsWith('workbox-')
      || path === '/favicon.ico'
      || path === '/robots.txt') {
      c.res.headers.set('cache-control', 'public, max-age=31536000, immutable')
    } else if (
      path === '/'
      || path === '/index.html'
      || path === '/sw.js'
      || path === '/manifest.json') {
      c.res.headers.set('cache-control', 'no-cache')
    }
  })

  // --- 静态托管（生产：vite build 产物） ---
  app.use('*', serveStatic({ root: distRoot }))
  // SPA fallback：未命中文件的路径回 index.html（PWA/深链接）
  app.get('*', serveStatic({ root: distRoot, rewriteRequestPath: () => '/index.html' }))

  return app
}
