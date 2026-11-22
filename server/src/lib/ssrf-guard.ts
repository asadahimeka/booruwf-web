/**
 * SSRF 防护（移植自 pxve-api src/lib/ssrf-guard.ts，DNS 解析改用 node:dns）。
 *
 * 本项目 /img 与 claim 域放行到「语法合法的公网 https 域」（见 sites.ts），
 * PUBLIC_HOST_RE 只挡了字面 IP 与 localhost 形态的 host，挡不住：
 * - DNS rebinding / nip.io 类域名（127.0.0.1.nip.io 解析到回环地址）
 * - 云元数据端点（169.254.169.254 等）
 * - IP-echo 服务（ifconfig.me 等，服务器会被当 IP 探测 oracle）
 *
 * assertSafeUrl 在白名单校验之外补这三层：非字面 IP 的域名先做 DNS 解析，
 * 解析结果任一 IP 落在私网/保留段即拒绝（block-on-error）。
 *
 * 环境变量：
 * - PROXY_ALLOW_DOMAINS / PROXY_BLOCK_DOMAINS：逗号分隔的额外域白/黑名单（支持 *.）
 * - PROXY_ALLOW_IP_ECHO=1：关闭内置 IP-echo 黑名单
 * - SSRF_DNS_CHECK=0：关闭 DNS 解析校验（如经上游代理解析、本地 DNS 异常的环境）
 */
import { resolve4, resolve6 } from 'node:dns/promises'

const PRIVATE_RE
  = /^(10\.|100\.(6[4-9]|[7-9]\d|1[0-2][0-7])\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.|127\.|0\.0\.0\.0|169\.254\.)/

const METADATA_HOSTS = ['169.254.169.254', 'metadata.google.internal', '100.100.100.200']

/**
 * 内置 IP-echo / 请求回显服务黑名单。
 *
 * 所有抓取用户提供的 URL 的路由（/proxy /img /dl）都由本服务端转发请求，
 * 远端目标看到的是服务器出口 IP。放行用户代理一个 IP-echo 服务
 * （如 /img?url=https://ifconfig.me/ip）等于把网关变成公开的出口 IP oracle ——
 * 服务器在 CDN 后或家庭宽带场景下这就是泄露。属纵深防御（攻击者自有域名
 * 无法彻底封禁），真正的隔离靠域名白名单。
 */
const IP_ECHO_BLOCKLIST = [
  // 通用 HTTP echo / 请求检查服务（回显调用方 IP）
  'httpbin.org',
  'httpstat.us',
  'postman-echo.com',
  'webhook.site',
  // 专用 IP echo / 查询服务
  'canhazip.com',
  'checkip.amazonaws.com',
  'checkip.dyndns.com',
  'checkip.dyndns.org',
  'cip.cc',
  'geojs.io',
  'icanhazip.com',
  'ident.me',
  'ifconfig.co',
  'ifconfig.me',
  'ip-api.com',
  'ip.3322.net',
  'ip111.cn',
  'ip138.com',
  'ip.cn',
  'ip.sb',
  'ip.im',
  'ipshu.com',
  'ip2location.io',
  'ipapi.co',
  'ipapi.com',
  'ipcheck.ing',
  'ipdata.co',
  'ipgeolocation.io',
  'ipify.org',
  'ipinfo.io',
  'ipinfo.tw',
  'ipip.net',
  'ipecho.net',
  'ipwho.is',
  'ipwhois.app',
  'myexternalip.com',
  'myip.com',
  'seeip.org',
  'whatismyip.com',
  'whatismyipaddress.com',
  'wtfismyip.com',
]

/** 匹配 IP_ECHO_BLOCKLIST：精确项或任意子域（api.ipify.org → ipify.org） */
function isIpEchoHost(hostname: string): boolean {
  const h = hostname.toLowerCase()
  return IP_ECHO_BLOCKLIST.some(d => h === d || h.endsWith(`.${d}`))
}

const DNS_CACHE_TTL_MS = 60_000
const DNS_TIMEOUT_MS = 2_000

/** DNS 解析缓存：hostname → { ips, expiresAt }（简单 LRU，上限 1000 条） */
const dnsCache = new Map<string, { ips: string[]; expiresAt: number }>()
const DNS_CACHE_MAX_SIZE = 1000

/**
 * 判断 hostname（可能为带方括号的 IPv6）是否私网/保留地址。
 * 覆盖 IPv4 私网段、IPv6 回环/ULA/链路本地、IPv4-mapped IPv6。
 */
function isPrivateHost(hostname: string): boolean {
  const h = hostname.startsWith('[') && hostname.endsWith(']') ? hostname.slice(1, -1) : hostname

  if (PRIVATE_RE.test(h)) return true

  // IPv6：必须含冒号
  if (!h.includes(':')) return false

  // ::1 回环、:: 未指定地址
  if (h === '::1' || h === '::') return true

  // fc00::/7 — unique local（fc00:: ~ fdff::）
  if (/^fd/i.test(h) || /^fc/i.test(h)) return true

  // fe80::/10 — 链路本地（fe80:: ~ febf::）
  if (/^fe[89ab]/i.test(h)) return true

  // ::ffff:0:0/96 — IPv4-mapped IPv6（容忍前导零 hextet）
  const ffffMatch = h.match(/^::ffff:(?:0+:)*([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i)
  if (ffffMatch) {
    const high = Number.parseInt(ffffMatch[1], 16)
    const low = Number.parseInt(ffffMatch[2], 16)
    const ipv4 = `${(high >> 8) & 0xFF}.${high & 0xFF}.${(low >> 8) & 0xFF}.${low & 0xFF}`
    return PRIVATE_RE.test(ipv4)
  }

  // 旧式 IPv4 兼容 IPv6：::<hex1>:<hex2>，按 IPv4-mapped 同样处理
  const legacyMatch = h.match(/^::([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i)
  if (legacyMatch) {
    const high = Number.parseInt(legacyMatch[1], 16)
    const low = Number.parseInt(legacyMatch[2], 16)
    const ipv4 = `${(high >> 8) & 0xFF}.${high & 0xFF}.${(low >> 8) & 0xFF}.${low & 0xFF}`
    return PRIVATE_RE.test(ipv4)
  }

  return false
}

/** 判断一个 IP 字符串是否私网/保留地址 */
function isPrivateIp(ip: string): boolean {
  if (PRIVATE_RE.test(ip)) return true
  if (METADATA_HOSTS.includes(ip)) return true

  if (ip.includes(':')) {
    if (ip === '::1' || ip === '::') return true
    if (/^fd/i.test(ip) || /^fc/i.test(ip)) return true
    if (/^fe[89ab]/i.test(ip)) return true
  }

  return false
}

/** 判断 hostname 是否字面 IP（无需 DNS 解析） */
function isLiteralIp(hostname: string): boolean {
  const h = hostname.startsWith('[') && hostname.endsWith(']') ? hostname.slice(1, -1) : hostname
  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(h)) return true
  if (h.includes(':')) return true
  return false
}

/** 逗号分隔的环境变量 → 数组 */
function commaList(name: string): string[] {
  return process.env[name]?.split(',').map(s => s.trim()).filter(Boolean) ?? []
}

/** 带 2s 超时的 DNS A + AAAA 解析（结果缓存 60s），解析失败/无记录均抛错 */
async function resolveAndCheck(hostname: string): Promise<string[]> {
  const now = Date.now()
  const cached = dnsCache.get(hostname)
  if (cached && now < cached.expiresAt) {
    return cached.ips
  }
  // DNS 库不支持跨运行时统一的 abort 信号，用 Promise.race 实现超时
  let timer: ReturnType<typeof setTimeout> | undefined
  const [aRecords, aaaaRecords] = await Promise.race([
    Promise.all([
      resolve4(hostname).catch(() => [] as string[]),
      resolve6(hostname).catch(() => [] as string[]),
    ]),
    new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => reject(new Error(`DNS resolution timed out: ${hostname}`)), DNS_TIMEOUT_MS)
    }),
  ]).finally(() => clearTimeout(timer))
  const ips = [...aRecords, ...aaaaRecords]

  if (ips.length === 0) {
    throw new Error(`DNS resolution returned no records: ${hostname}`)
  }
  dnsCache.set(hostname, { ips, expiresAt: Date.now() + DNS_CACHE_TTL_MS })
  // 超上限时按插入序淘汰最旧条目
  if (dnsCache.size > DNS_CACHE_MAX_SIZE) {
    const oldestKey = dnsCache.keys().next().value
    if (oldestKey !== undefined) dnsCache.delete(oldestKey)
  }
  return ips
}

/**
 * 校验目标 URL 的 SSRF 安全性，不通过则抛错（fail-closed）。
 * 在各 handler 的协议/白名单校验之后、upstreamFetch 之前调用。
 */
export async function assertSafeUrl(input: string | URL): Promise<URL> {
  const u = typeof input === 'string' ? new URL(input) : input
  if (!['http:', 'https:'].includes(u.protocol)) {
    throw new Error(`blocked protocol: ${u.protocol}`)
  }
  if (isPrivateHost(u.hostname)) {
    throw new Error(`blocked private: ${u.hostname}`)
  }
  if (METADATA_HOSTS.includes(u.hostname)) {
    throw new Error('blocked metadata')
  }

  const allow = commaList('PROXY_ALLOW_DOMAINS')
  if (allow.length) {
    const ok = allow.some(d => (d.startsWith('*.') ? u.hostname.endsWith(d.slice(1)) : u.hostname === d))
    if (!ok) throw new Error(`blocked allowlist: ${u.hostname}`)
  }
  const block = commaList('PROXY_BLOCK_DOMAINS')
  if (block.some(d => (d.startsWith('*.') ? u.hostname.endsWith(d.slice(1)) : u.hostname === d))) {
    throw new Error(`blocked domain: ${u.hostname}`)
  }

  // 内置 IP-echo 黑名单（PROXY_ALLOW_IP_ECHO=1 可关闭）
  if (process.env.PROXY_ALLOW_IP_ECHO !== '1' && isIpEchoHost(u.hostname)) {
    throw new Error('blocked bad request')
  }

  // 非字面 IP 的域名做 DNS 解析校验，防 nip.io / rebinding 绕过
  if (process.env.SSRF_DNS_CHECK !== '0' && !isLiteralIp(u.hostname)) {
    const resolvedIps = await resolveAndCheck(u.hostname)
    for (const ip of resolvedIps) {
      if (isPrivateIp(ip)) {
        throw new Error(`blocked resolved private: ${ip} (via ${u.hostname})`)
      }
    }
  }

  return u
}
