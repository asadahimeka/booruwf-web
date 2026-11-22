/**
 * 日志 / 错误脱敏（移植自 pxve-api src/lib/sanitize.ts）。
 *
 * 网关日志与错误信息里经常带着上游 URL（可能含 token/key 类 query 参数），
 * 直接打印或回传给客户端会泄露敏感值；这里统一把敏感参数值打码。
 * toPublicError 用于全局 onError：对外只返回 requestId，不泄露内部错误细节。
 */
const SENSITIVE_KEYS = 'api[_-]?key|access[_-]?token|auth[_-]?token|token|PHPSESSID|ct0|key|secret|password'
const SENSITIVE_RE = new RegExp(`(^|\\?|&)(${SENSITIVE_KEYS})=[^&\\s]*`, 'gi')

function applySanitize(raw: string): string {
  return raw.replace(SENSITIVE_RE, (_, sep, name) => `${sep}${name}=***`)
}

export function sanitizeUrl(raw: string): string {
  try {
    // eslint-disable-next-line no-new
    new URL(raw)
    return applySanitize(raw)
  } catch {
    return raw
  }
}

/** 脱敏一个错误值（Error.message 或字符串），打掉敏感 query 参数值 */
export function sanitizeError(err: unknown): string {
  const str = err instanceof Error ? (err.message ?? String(err)) : String(err)
  return applySanitize(str)
}

/** 全局 500 兜底：内部细节只进日志，对外仅回 requestId 便于对账 */
export function toPublicError(err: unknown): { error: string; requestId: string } {
  const id = crypto.randomUUID().slice(0, 8)
  console.error('[ERROR]:', new Date().toLocaleString('zh'), `[${id}]`, sanitizeError(err))
  return { error: 'Internal Server Error', requestId: id }
}
