/**
 * Bun 运行时入口：
 *   pnpm -C server start:bun    （或 cd server && bun src/entry/bun.ts）
 */
import { relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { getConnInfo, serveStatic } from 'hono/bun'
import { PORT, createApp } from '../core/index.ts'

// 本仓库仅在 Node 环境安装 TS（Node 入口跑 tsc check），Bun/Deno 全局随运行时存在，
// 这里给出覆盖本文件用法的最小声明
declare const Bun: {
  serve(options: { fetch: (req: Request) => Response | Promise<Response>; port: number }): unknown
}

const distAbs = fileURLToPath(new URL('../../../dist', import.meta.url))
const distRoot = relative(process.cwd(), distAbs).replace(/\\/g, '/') || '.'

const app = createApp({
  serveStatic: opts => serveStatic(opts),
  distRoot,
  // 限流/拦截中间件的客户端 IP 来源（回环豁免依赖它）
  getClientIp: c => getConnInfo(c)?.remote?.address,
})

Bun.serve({
  fetch: app.fetch,
  port: PORT,
})

console.log(`[booruwf-server] bun listening on http://127.0.0.1:${PORT} (dist: ${distRoot})`)
