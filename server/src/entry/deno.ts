/**
 * Deno 运行时入口：
 *   pnpm -C server start:deno
 *   （即 deno run -A --node-modules-dir src/entry/deno.ts，需在 server/ 目录内执行）
 *
 * 注意：沙箱/系统若注入 HTTP_PROXY 等环境变量，Deno/Bun 的 fetch 会默认走该代理，
 * 本地直连测试时可先剔除这些变量。
 */
import { relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { getConnInfo, serveStatic } from 'hono/deno'
import { PORT, createApp } from '../core/index.ts'

// 本仓库仅在 Node 环境安装 TS（Node 入口跑 tsc check），Bun/Deno 全局随运行时存在，
// 这里给出覆盖本文件用法的最小声明
declare const Deno: {
  cwd(): string
  serve(options: { port: number; handler: (req: Request) => Response | Promise<Response> }): unknown
}

const distAbs = fileURLToPath(new URL('../../../dist', import.meta.url))
const distRoot = relative(Deno.cwd(), distAbs).replace(/\\/g, '/') || '.'

const app = createApp({
  serveStatic: opts => serveStatic(opts),
  distRoot,
  // 限流/拦截中间件的客户端 IP 来源（回环豁免依赖它）
  getClientIp: c => getConnInfo(c)?.remote?.address,
})

// Deno 2.x 的 serve 选项键是 handler（不是 fetch）
Deno.serve({ port: PORT, handler: req => app.fetch(req) })

console.log(`[booruwf-server] deno listening on http://127.0.0.1:${PORT} (dist: ${distRoot})`)
