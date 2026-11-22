/**
 * 冒烟测试：对本地起的服务端做一轮基本验收（三运行时各跑一次，行为应一致）。
 * 用法：先启动服务端，再执行 pnpm -C server smoke
 */
import { PORT } from '../core/index.ts'

const base = `http://127.0.0.1:${PORT}`

interface Case {
  name: string
  url: string
  expect: (res: Response, body: string) => string | true
}

const cases: Case[] = [
  {
    name: 'healthz',
    url: `${base}/healthz`,
    expect: (_res, body) => body.includes('"ok":true') ? true : `unexpected body: ${body}`,
  },
  {
    name: 'proxy: moebooru post.json (allowed domain)',
    url: `${base}/proxy?url=${encodeURIComponent('https://yande.re/post.json?limit=1&page=1')}`,
    expect: (res, body) => {
      if (!res.ok) return `status ${res.status}`
      return body.includes('"id"') || body.includes('preview_url') || body.includes('file_url')
        ? true
        : `unexpected body head: ${body.slice(0, 120)}`
    },
  },
  {
    name: 'proxy: disallowed domain rejected',
    url: `${base}/proxy?url=${encodeURIComponent('https://example.com/')}`,
    expect: res => res.status === 403 ? true : `expected 403, got ${res.status}`,
  },
  {
    name: 'img: allowed image URL passes through pipeline',
    url: `${base}/img?url=${encodeURIComponent('https://cdn.donmai.us/preview/d7/16/d716343a20e2ea5370e15ae5a26c92f8.jpg')}`,
    expect: (res, body) => {
      // 只验证代理管线与白名单逻辑（该测试 URL 并非真实存在的文件）：
      // 我们自己的 403（域名拒绝）返回 JSON error；上游任何状态码（含 403/404）都算管线通过
      if (res.status === 403 && body.includes('domain not allowed')) { return 'our whitelist rejected an allowed domain' }
      return res.status < 500 ? true : `unexpected status ${res.status}`
    },
  },
  {
    name: 'static: SPA fallback serves index.html (if built)',
    url: `${base}/`,
    expect: (res, body) => {
      if (res.status === 404) return 'dist/ not built yet — run `pnpm build` first (skip)'
      return body.includes('<div id="app">') ? true : 'unexpected index.html'
    },
  },
]

for (const c of cases) {
  try {
    const res = await fetch(c.url, { redirect: 'manual' })
    const body = await res.text()
    const result = c.expect(res, body)
    console.log(`${result === true ? 'PASS' : 'FAIL'}  ${c.name}${result === true ? '' : ` -> ${result}`}`)
  } catch (err) {
    console.log(`FAIL  ${c.name} -> ${(err as Error).message}`)
  }
}
