/**
 * 轻量 .env 加载器（无依赖，Node/Bun/Deno 通用）。
 *
 * Bun / Deno 会自动加载 .env，只有 Node 不会 —— 这里补齐缺口。
 * 仅当变量尚未定义时写入：CLI 参数 > shell 环境 > Bun/Deno 自动加载 > .env 文件。
 * .env 位置固定为 server/ 目录（相对本文件解析，与启动 cwd 无关，
 * 仓库根目录或 server/ 目录启动均可生效）。
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

export function loadDotEnv(): void {
  const path = fileURLToPath(new URL('../../.env', import.meta.url))
  let content: string
  try {
    content = readFileSync(path, 'utf8')
  } catch {
    return // 没有 .env 属正常形态（生产环境直接走系统环境变量）
  }
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq <= 0) continue
    const key = line.slice(0, eq).trim()
    let value = line.slice(eq + 1).trim()
    // 去掉成对包裹的引号（支持值里含 # 或空格）
    if (
      (value.startsWith('"') && value.endsWith('"'))
      || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    if (key in process.env) continue
    process.env[key] = value
  }
}
