/**
 * 上游请求实现的可替换点。
 *
 * Node 入口注入走 ProxyAgent 的 fetch（npm undici 的 setGlobalDispatcher
 * 不影响 Node 内置的全局 fetch —— 两者是独立的 undici 实例，见 entry/node.ts）。
 * Bun / Deno 的全局 fetch 可通过各自环境变量/HttpClient 支持，入口按需注入。
 */

let impl: typeof globalThis.fetch = (input, init) => globalThis.fetch(input as any, init)

export function setUpstreamFetch(f: typeof globalThis.fetch) {
  impl = f
}

export function upstreamFetch(input: string | URL, init?: RequestInit): Promise<Response> {
  return impl(input as any, init as any) as unknown as Promise<Response>
}
