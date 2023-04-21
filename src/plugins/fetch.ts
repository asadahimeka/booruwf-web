const _fetch = window.fetch

const proxy = localStorage.getItem('__apiProxy') || 'https://nfn.kanata.ml/'

window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
  let url = input.toString()
  if (url.startsWith('https') && !url.includes('jsdelivr') && !url.includes('ummst.nanoka.top')) {
    url = proxy + url
  }
  return _fetch(url, init)
}

export {}
