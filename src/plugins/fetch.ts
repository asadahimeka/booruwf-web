import { apiProxys } from '@/store'

const _fetch = window.fetch

const proxy = localStorage.getItem('__apiProxy') || apiProxys[0].value

window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
  let url = input.toString()
  if (url.startsWith('https') && !url.includes('jsdelivr') && !url.includes('ummst.nanoka.top')) {
    url = proxy + url
  }
  return _fetch(url, init)
}

export {}
