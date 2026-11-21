/**
 * 文件名校验/清洗 —— 只保留纯字符串逻辑，不依赖任何运行时（便于单测与被 fsa / download 两端复用）。
 *
 * File System Access API 对文件名比 URL 严格得多，`getFileHandle(name)` 遇到下列任一情况
 * 直接抛 NotAllowedError（"Name is not allowed."）：
 * - 含路径分隔符 `/` 或 `\`
 * - 含 Windows 保留字符 < > : " | ? *
 * - 整名为 `.` / `..`，或以点、空格结尾
 * - 空名，或超过 255 字节（UTF-8）
 * - Windows 设备保留名（CON / PRN / AUX / NUL / COM1-9 / LPT1-9）
 *
 * 而各站给的 `fileDownloadName` 往往是文章标题（everia、hentaiclub 等），带 `?`、`:`、`/`
 * 和尾部省略号很常见，因此统一在落盘前清洗。
 */

// eslint-disable-next-line no-control-regex, unicorn/escape-case
const INVALID_CHARS = /[<>:"/\\|?*\u0000-\u001f\u007f]/g
const WINDOWS_RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i
/** 单段名上限 255 字节，留一点余量（部分平台按 255 个 UTF-16 码元另算） */
const MAX_NAME_BYTES = 240

const encoder = new TextEncoder()
const byteLength = (s: string) => encoder.encode(s).length

/**
 * 把任意字符串清洗成可落盘的文件名。
 * 保留原扩展名（最后一个点之后的部分），超长时优先截断主体而不是扩展名。
 */
export function sanitizeFileName(name: string) {
  const raw0 = (name || '').trim()
  // 名字里出现 ? / # 基本是「URL 尾巴被当成文件名」的结果（`a.jpg?token=1`），直接截断，
  // 否则清洗后会被拼成 `a.jpgtoken=1` 这种既不像扩展名也不像名字的东西
  const cut = raw0.search(/[?#]/)
  const raw = cut >= 0 ? raw0.slice(0, cut) : raw0
  const dot = raw.lastIndexOf('.')
  // 只有「点不在首位」才当扩展名，避免把 `.gitignore` 拆成空主体
  let base = dot > 0 ? raw.slice(0, dot) : raw
  let ext = dot > 0 ? raw.slice(dot) : ''

  base = base
    .replace(INVALID_CHARS, '_')
    .replace(/^[\s.]+/, '')
    .replace(/[\s.]+$/, '')
  ext = ext.replace(INVALID_CHARS, '').replace(/[\s.]+$/, '')
  // 只有一个点（如 `x.`）不算扩展名——否则会留下 `x.` 这种以点结尾的非法名
  if (ext === '.') ext = ''

  if (!base) base = 'file'
  if (WINDOWS_RESERVED.test(base)) base = `_${base}`

  const limit = Math.max(16, MAX_NAME_BYTES - byteLength(ext))
  if (byteLength(base) > limit) {
    // 逐字符回退，避免把多字节字符截断成乱码
    let truncated = base
    while (truncated.length > 1 && byteLength(truncated) > limit) truncated = truncated.slice(0, -1)
    base = truncated
  }

  return base + ext
}

/**
 * 从下载 URL 推断扩展名：先去掉 query/hash，再取最后一个点之后的部分。
 * 旧写法直接 `url.split('.').pop()`，遇到 `a.jpg?token=1` 会把 `jpg?token=1`
 * 整段当成扩展名拼进文件名，于是 FSA 报 "Name is not allowed."。
 */
export function extFromUrl(url: string) {
  const path = url.split('#')[0].split('?')[0]
  const last = path.split('/').pop() || ''
  const dot = last.lastIndexOf('.')
  if (dot <= 0) return ''
  const ext = last.slice(dot + 1).toLowerCase()
  return /^[a-z0-9]{1,8}$/.test(ext) ? ext : ''
}
