// 从 packages/booru/sites.json 生成 server/src/core/allowed-domains.ts 白名单
// 用法：node scripts/generate-allowed-domains.mjs
//
// 白名单的语义（2026-11 重构）：
// 「API / HTML 端点域」+「适配器代码里硬编码的图床域」都从这里出。
// 图床域名多变（kontol/airibox/fujibox 等隔几个月换一批），靠手工维护
// extraDomains 必然漏。这里的对策是双管齐下：
//   1. 本脚本自动收集 sites.json + 前端适配器源码里全部硬编码域名；
//   2. server 侧对 /img 的放行另有一条动态通道（runtime 允许列表，见 sites.ts），
//      覆盖「响应来自我们已放行域名的页面」里出现的新图床。
import { readFileSync, writeFileSync, readdirSync } from 'node:fs'

const sites = JSON.parse(readFileSync('./packages/booru/sites.json', 'utf8'))
const siteDomains = [...new Set(Object.values(sites).map(s => s.domain))]

// 从前端适配器源码收集全部硬编码 https 域名（API 与图床都会被抓到）
const apiDir = './src/api'
const hardcoded = new Set()
for (const f of readdirSync(apiDir)) {
  if (!f.endsWith('.ts')) continue
  const src = readFileSync(`${apiDir}/${f}`, 'utf8')
  for (const m of src.matchAll(/https?:\/\/[A-Za-z0-9.-]+\.[A-Za-z]+/g)) {
    let host = m[0].replace(/^https?:\/\//, '')
    // 归一化：剥掉主机名前缀（img1. / qtn. / api. 等），登记裸域；
    // isAllowedDomain 用后缀匹配，子域自动覆盖
    const parts = host.split('.')
    // 保留二级裸域（>=2 段时取后两段；三级域如 .co.jp 场景这里没有）
    if (parts.length > 2 && !/^(com|net|org|co|ne|or|gov|edu)$/i.test(parts[parts.length - 2]) === false) {
      host = parts.slice(-2).join('.')
    } else if (parts.length > 2) {
      host = parts.slice(-2).join('.')
    }
    hardcoded.add(host)
  }
}

const domains = [...new Set([...siteDomains, ...hardcoded])].sort()

const header = `/**
 * 由 packages/booru/sites.json + src/api/*.ts 硬编码域名自动生成的白名单。
 * 重新生成：node scripts/generate-allowed-domains.mjs
 */

export const booruSiteDomains: string[] = ${JSON.stringify(domains, null, 2)}
`

writeFileSync('./server/src/core/allowed-domains.ts', header)
console.log(`${domains.length} domains written (sites.json: ${siteDomains.length}, +hardcoded: ${hardcoded.size})`)
