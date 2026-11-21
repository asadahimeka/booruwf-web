import type { Post } from '@himeka/booru'

export type DownloadUrlKey = 'sampleUrl' | 'jpegUrl' | 'fileUrl'
export type DownloadNameKey = 'sampleDownloadName' | 'jpegDownloadName' | 'fileDownloadName'

interface DownloadablePost extends Partial<Record<DownloadUrlKey | DownloadNameKey, string | null>> {
  fileUrl?: string | null
  fileDownloadName?: string | null
  sampleDownloadName?: string | null
  jpegDownloadName?: string | null
}

const downloadNameMap: Record<DownloadUrlKey, DownloadNameKey> = {
  sampleUrl: 'sampleDownloadName',
  jpegUrl: 'jpegDownloadName',
  fileUrl: 'fileDownloadName',
}

const downloadFallbackMap: Record<DownloadUrlKey, DownloadUrlKey[]> = {
  sampleUrl: ['sampleUrl', 'fileUrl', 'jpegUrl'],
  jpegUrl: ['jpegUrl', 'fileUrl', 'sampleUrl'],
  fileUrl: ['fileUrl', 'sampleUrl', 'jpegUrl'],
}

export function getAvailableDownloadUrlKeys(hasSampleUrl: boolean, hasJpegUrl: boolean) {
  const keys: DownloadUrlKey[] = []
  if (hasSampleUrl) keys.push('sampleUrl')
  if (hasJpegUrl) keys.push('jpegUrl')
  keys.push('fileUrl')
  return keys
}

export function getActiveDownloadUrlKey(keys: readonly DownloadUrlKey[], preferred: DownloadUrlKey) {
  return keys.find(key => key === preferred) || keys[0] || 'fileUrl'
}

export function resolvePostDownloadSource(post: DownloadablePost | Post, preferred: DownloadUrlKey) {
  for (const key of downloadFallbackMap[preferred]) {
    const url = post[key]
    if (!url) continue
    return {
      key,
      url,
      name: post[downloadNameMap[key]] || post.fileDownloadName || post.sampleDownloadName || post.jpegDownloadName || '',
    }
  }

  return {
    key: preferred,
    url: null,
    name: post.fileDownloadName || post.sampleDownloadName || post.jpegDownloadName || '',
  }
}
