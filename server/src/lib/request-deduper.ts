/**
 * 并发相同请求合并（inflight dedup，移植自 pxve-api src/lib/request-deduper.ts）。
 *
 * 瀑布流首屏会并发几十个 /proxy 请求，若同一 URL 的多个请求同时到达，
 * 各自打一次上游容易触发上游风控（danbooru 403 等）。本类保证同 key 的
 * 并发请求只执行一次 fn，其余共享缓冲后的响应结果。
 *
 * 与 proxy.ts 的 60s 内存缓存互补：缓存挡「已完成」的重复，本类挡「进行中」的重复。
 *
 * 注意事项：
 * - 响应体缓冲有上限（DEDUP_BODY_MAX，默认 5MB）：超限返回 null，此时每个
 *   等待者各自回退执行 fn（与大响应直连透传的开销一致，不会更差）
 * - 队列容量有上限（DEDUPER_MAX）：超过直接抛错，防止并发风暴撑爆内存
 * - 纯 Web API 实现（fetch Response / TextEncoder），三运行时通用
 */
import { sanitizeError, sanitizeUrl } from './sanitize.ts'

const DEDUPER_MAX = Number(process.env.DEDUPER_MAX ?? 500)
const DEDUP_BODY_MAX = Number(process.env.DEDUP_BODY_MAX ?? 5 * 1024 * 1024)

interface Buffered { init: ResponseInit; buf: Uint8Array }

function internalError(key: string, err: any): Buffered {
  console.error('[ERROR]:', new Date().toLocaleString('zh'), sanitizeUrl(key), sanitizeError(err))
  return {
    init: { status: 500, headers: { 'content-type': 'application/json' } },
    buf: new TextEncoder().encode(JSON.stringify({ error: 'Internal Server Error' })),
  }
}

/** 按上限读流：content-length 或累计字节数超过 cap 时取消读取返回 null */
async function readCapped(res: Response, cap: number): Promise<Uint8Array | null> {
  const cl = res.headers.get('content-length')
  const n = cl === null ? Number.NaN : Number(cl)
  if (Number.isFinite(n) && n > cap) {
    await res.body?.cancel().catch(() => {})
    return null
  }
  const reader = res.body?.getReader()
  if (!reader) return new Uint8Array(0)
  const chunks: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > cap) {
      await reader.cancel().catch(() => {})
      return null
    }
    chunks.push(value)
  }
  const buf = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    buf.set(chunk, offset)
    offset += chunk.byteLength
  }
  return buf
}

export class RequestDeduper {
  map: Map<string, Promise<Buffered | null>>

  private maxBodyBytes: number

  constructor(maxBodyBytes: number = DEDUP_BODY_MAX) {
    this.maxBodyBytes = maxBodyBytes
    this.map = new Map()
  }

  async run(key: string, fn: (...args: any[]) => Response | Promise<Response>): Promise<Response> {
    let promise = this.map.get(key)
    if (!promise) {
      if (this.map.size >= DEDUPER_MAX) {
        throw new Error('Deduper queue full')
      }
      promise = (async (): Promise<Buffered | null> => {
        try {
          const res = await fn()
          const buf = await readCapped(res, this.maxBodyBytes)
          if (buf === null) return null
          return {
            init: { status: res.status, statusText: res.statusText, headers: res.headers },
            buf,
          }
        } catch (err: any) {
          return internalError(key, err)
        } finally {
          this.map.delete(key)
        }
      })()
      this.map.set(key, promise)
    }
    const data = await promise
    if (data === null) {
      // 大响应（>DEDUP_BODY_MAX）不缓冲共享，每个调用方自己执行一遍
      try {
        return await fn()
      } catch (err: any) {
        const fb = internalError(key, err)
        return new Response(fb.buf.slice(), fb.init)
      }
    }
    // 注意 slice：Buffered 会被多个等待方共享，Response 构造会消费 buf，必须拷贝
    return new Response(data.buf.byteLength ? data.buf.slice() : null, data.init)
  }
}
