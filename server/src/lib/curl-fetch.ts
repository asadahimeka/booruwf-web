/**
 * 基于 curl 子进程的上游请求实现（仅 Node 运行时使用）。
 *
 * 背景：danbooru / e621 等站挂 Cloudflare，对 Node fetch 的 TLS 指纹（JA3）
 * 直接返回 403 challenge；而 curl / 浏览器的指纹不在封锁名单里，实测可通
 * （curl 200 / node fetch 403，2026-11 实测）。因此对这批域名改用 curl
 * 子进程发请求，其余域名仍走原生 fetch（可带 undici ProxyAgent）。
 *
 * 三运行时约定：本文件依赖 node:child_process，只能被 entry/node.ts 引入，
 * 不得被 core/ 引用（core 只用 Web 标准 API）。Bun / Deno 的全局 fetch
 * TLS 指纹不同，如被封锁可在各自入口按同样思路注入（bun:spawn / Deno.Command）。
 */
import { spawn } from 'node:child_process'

interface CurlFetchInit {
  headers?: Headers
  method?: string
  body?: ArrayBuffer
  redirect?: 'follow' | 'manual'
}

/** curl 退出码 → 可读信息（常用项） */
const CURL_ERRORS: Record<number, string> = {
  6: 'couldn\'t resolve host',
  7: 'connection refused',
  28: 'timeout',
  35: 'TLS handshake failure',
  56: 'recv failure',
}

function headerEntries(headers?: HeadersInit): [string, string][] {
  if (!headers) return []
  return [...new Headers(headers as any).entries()]
}

/** 扫描 stdout：最后一个以 `HTTP/` 开头的段是最终响应头，其余是 body */
function splitResponse(stdout: Buffer): { status: number; headers: Headers; body: Buffer } {
  const text = stdout.toString('latin1')
  let bodyStart = -1
  let headerBlock = ''
  let searchFrom = 0
  for (;;) {
    const at = text.indexOf('HTTP/', searchFrom)
    if (at < 0) break
    const end = text.indexOf('\r\n\r\n', at)
    if (end < 0) break
    headerBlock = text.slice(at, end)
    bodyStart = end + 4
    searchFrom = at + 1
    // 严格讲 body 里也可能出现 "HTTP/"，但概率极低；真出现了也只是多扫一段
  }
  if (bodyStart < 0) throw new Error('curl: no response header parsed')

  const lines = headerBlock.split('\r\n')
  const status = Number(lines[0].split(' ')[1]) || 500
  const headers = new Headers()
  for (const line of lines.slice(1)) {
    const at = line.indexOf(':')
    if (at <= 0) continue
    const name = line.slice(0, at).trim()
    const value = line.slice(at + 1).trim()
    try {
      headers.set(name, value)
    } catch {
      // 个别非法 header 名忽略
    }
  }
  return { status, headers, body: stdout.subarray(bodyStart) }
}

export function curlFetch(input: string | URL, init: CurlFetchInit = {}): Promise<Response> {
  const url = input.toString()
  const proxy = process.env.UPSTREAM_PROXY ?? process.env.HTTPS_PROXY ?? process.env.HTTP_PROXY

  const args = ['-q', '-sS', '--compressed', '--max-time', '120', '-D', '-', '-o', '-']
  // 与原生 fetch 通道保持一致：配置了上游代理时 curl 也走同一出口
  if (proxy) args.push('-x', proxy)
  if (init.redirect !== 'manual') args.push('-L')
  for (const [name, value] of headerEntries(init.headers)) {
    args.push('-H', `${name}: ${value}`)
  }
  if (init.method && init.method !== 'GET') args.push('-X', init.method)
  if (init.body) {
    args.push('--data-binary', '@-')
  }
  args.push(url)

  return new Promise<Response>((resolve, reject) => {
    const child = spawn('curl', args, { windowsHide: true })
    const chunks: Buffer[] = []
    let stderr = ''
    child.stdout.on('data', (chunk: Buffer) => chunks.push(chunk))
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString()
    })
    child.on('error', reject)
    child.on('close', code => {
      if (code == null || code !== 0) {
        const hint = CURL_ERRORS[code ?? -1] ?? stderr.trim().split('\n').pop() ?? `curl exit ${code}`
        reject(new Error(`curl: ${hint}`))
        return
      }
      try {
        const { status, headers, body } = splitResponse(Buffer.concat(chunks))
        // ImageProxy 响应会被 Response 构造器按 content-length 校验，长内容（重定向链）
        // 偶有截断，这里统一解掉 content-length 避免误判
        headers.delete('content-length')
        // TS 5.7+ 的 BufferSource 泛型收窄导致 Buffer<ArrayBufferLike> 不再直接满足 BodyInit
        resolve(new Response(body as unknown as BodyInit, { status, headers }))
      } catch (e) {
        reject(e)
      }
    })
    if (init.body) {
      child.stdin.write(Buffer.from(init.body))
    }
    child.stdin.end()
  })
}
