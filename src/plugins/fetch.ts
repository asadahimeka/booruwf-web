const _fetch = window.fetch

const proxy = localStorage.getItem('__apiProxy') || 'https://cors-fetch.deno.dev/'

window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
  let url = input.toString()
  if (url.startsWith('https') && !url.includes('jsdelivr')) {
    url = proxy + url
  }
  return _fetch(url, init)
}

export {}
