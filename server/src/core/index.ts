/**
 * Hono 服务端核心：静态托管 + 代理网关。
 *
 * 三运行时兼容约定：
 * - 本文件只用 Web 标准 API（fetch / Request / Response / URL / streams）
 * - serveStatic 的实现与 dist 路径解析按运行时差异由各 entry 注入
 *   （见 entry/node.ts / bun.ts / deno.ts）
 * - 缓存为内存级（Map + TTL），不落盘
 */
import { Hono } from 'hono'
import { etag } from 'hono/etag'
import { secureHeaders } from 'hono/secure-headers'
import { proxyHandler } from './proxy.ts'
import { imgHandler } from './img.ts'
import { dlHandler } from './dl.ts'

export const PORT = Number(process.env.PORT || 8787)

export interface AppOptions {
  /** 各运行时对应的 serveStatic 实现 */
  serveStatic: (options: { root: string; rewriteRequestPath?: (p: string) => string }) => any
  /** dist 目录（entry 内解析为「相对当前 cwd 的路径」，如 '../dist'） */
  distRoot: string
}

export function createApp({ serveStatic, distRoot }: AppOptions) {
  const app = new Hono()

  app.use('*', async (ctx, next) => {
    const start = new Date()
    await next()
    const time = `${Date.now() - start.valueOf()}ms`
    ctx.res.headers.set('X-Response-Time', time)
    console.log(start.toLocaleString('zh'), ctx.req.method, ctx.res.status, time, ctx.req.url.slice(0, 150), ctx.req.header('User-Agent'), ctx.req.header('Origin'), ctx.req.header('Referer'))
  })
  app.use(secureHeaders({ crossOriginResourcePolicy: 'same-site' }))
  app.get('*', etag())

  // --- 代理网关（先于静态路由注册，避免被 SPA fallback 吞掉） ---
  app.get('/proxy/*', proxyHandler)
  app.post('/proxy/*', proxyHandler) // hentaiclub 等站点搜索用 POST
  app.get('/img/*', imgHandler)
  app.get('/dl/*', dlHandler)

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
      c.header('cache-control', 'public, max-age=31536000, immutable')
    } else if (
      path === '/'
      || path === '/index.html'
      || path === '/sw.js'
      || path === '/manifest.json') {
      c.header('cache-control', 'no-cache')
    }
  })

  // --- 静态托管（生产：vite build 产物） ---
  app.use('*', serveStatic({ root: distRoot }))
  // SPA fallback：未命中文件的路径回 index.html（PWA/深链接）
  app.get('*', serveStatic({ root: distRoot, rewriteRequestPath: () => '/index.html' }))

  return app
}
