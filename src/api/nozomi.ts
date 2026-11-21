import { apiFetch } from './gateway'
import { siteContext } from '@/site-context'

export function isNozomiPage() {
  return siteContext.host == 'nozomi.la' && (siteContext.pathname == '/' || siteContext.pathname == '')
}

let resPosts: any[] = []
export function fetchNozomiPosts(page: number) {
  resPosts = []
  return new Promise(resolve => {
    fetch_nozomi(page)

    let times = 0
    const si = setInterval(() => {
      times = times + 1
      if (times > 30) {
        clearInterval(si)
        resolve([])
        return
      }
      if (resPosts.length) {
        clearInterval(si)
        // 过滤空数据项（json 拉取失败时 results_array 里是 '' 占位），
        // 并保证 tags 是数组（老接口字段缺失时 join 会崩）
        const valid = resPosts.filter(e => e && e.tags)
        if (!valid.length) return
        resolve(valid.map(e => ({
          id: e.postid,
          postView: e.postView,
          previewUrl: e.previewUrl,
          fileUrl: e.fileUrl,
          tags: e.tags,
          width: e.width,
          height: e.height,
          aspectRatio: e.width / e.height,
          fileExt: e.type,
          fileDownloadName: `NOZOMI ${e.postid} ${e.tags.join(' ')}.${e.type}`,
          rating: '',
        })))
      }
    }, 1000)
  })
}

export const nozomila = {
  is: isNozomiPage,
  posts: fetchNozomiPosts,
}

const tns_per_page = 64
const nozomiextension = '.nozomi'
const nozomidir = 'nozomi'
const postdir = 'post'

const results_array: Record<string, any> = {}
const outstanding_requests: Record<string, any> = {}
let number_of_outstanding_requests = 0
const nozomi: number[] = []
let total_items = 0
const tag = 'index'; let area: string | undefined; /* let popular; */ let page_number
let nozomi_address
const domain = 'n.nozomi.la'

const full_path_from_hash = (hash: string) => {
  if (hash.length < 3) {
    return hash
  }
  return hash.replace(/^.*(..)(.)$/, `$2/$1/${hash}`)
}

const urlencode = (str: string) => {
  return str.replace(/[\;\/\?\:\@\=\&#%\+]/g, (c: string) => {
    return `%${c.charCodeAt(0).toString(16)}`
  })
}

const remove_slashes = (input: string) => {
  return input.replace(/[\/]/g, '')
}

function path_from_postid(postid: string) {
  if (postid.length < 3) return postid
  return postid.replace(/^(.*(..)(.))$/, '$3/$2/$1')
}

function fetch_nozomi(page: any) {
  page_number = page
  nozomi_address = `https://${domain}`
  if (area) {
    nozomi_address += `/${nozomidir}`
  }
  nozomi_address += `/${urlencode(remove_slashes(tag))}`
  nozomi_address += nozomiextension

  const start_byte = (page_number - 1) * tns_per_page * 4
  const end_byte = start_byte + tns_per_page * 4 - 1

  // web 版：走 /proxy 并透传 Range（全量索引 116MB 必须按页拉取）；
  // 上游不支持 Range 时退化为全量响应（此时按字节自行切片，仅首屏可用）
  apiFetch(nozomi_address, { as: 'arrayBuffer', headers: { range: `bytes=${start_byte}-${end_byte}` } })
    .then((full: ArrayBuffer | string) => {
      const buffer = full as ArrayBuffer
      // 206 分片：直接就是本页数据；200 全量：自行切片
      const sliceStart = Math.min(start_byte, buffer.byteLength)
      const sliceEnd = Math.min(end_byte + 1, buffer.byteLength)
      const arrayBuffer = buffer.byteLength === end_byte - start_byte + 1
        ? buffer
        : buffer.slice(sliceStart, sliceEnd)
      if (arrayBuffer.byteLength) {
        const view = new DataView(arrayBuffer)
        for (let pos = 0; pos < view.byteLength; pos += 4) {
          nozomi.push(view.getUint32(pos, false /* big-endian */))
        }
        if (buffer.byteLength > tns_per_page * 4) total_items = buffer.byteLength / 4
        console.log('total_items: ', total_items)
        get_jsons()
      }
    })
}

function get_jsons() {
  const datas = []
  for (const i in nozomi) {
    const postid = nozomi[i]
    if (postid in results_array) {
      if (results_array[postid]) datas.push(results_array[postid])
      continue
    }
    if (!outstanding_requests[postid]) {
      outstanding_requests[postid] = 1
      ++number_of_outstanding_requests
      get_json(postid) // calling a function is REQUIRED to give postid its own scope
    }
  }
  if (number_of_outstanding_requests) return

  results_to_page(datas)
}

function get_json(postid: string | number) {
  const url = `https://j.gold-usergeneratedcontent.net/${postdir}/${path_from_postid(postid.toString())}.json`
  apiFetch(url).then(text => {
    try {
      results_array[postid] = JSON.parse(text)
    } catch {
      results_array[postid] = ''
    }
    delete outstanding_requests[postid]
    --number_of_outstanding_requests
    get_jsons()
  }).catch(() => {
    results_array[postid] = ''
    delete outstanding_requests[postid]
    --number_of_outstanding_requests
    get_jsons()
  })
}

function results_to_page(datas: any[]) {
  for (const d in datas) {
    const data = datas[d]
    if (!data) continue
    data.tags = [
      ...(data.artist?.map((e: { tag: any }) => e.tag) || []),
      ...(data.copyright?.map((e: { tag: any }) => e.tag) || []),
      ...(data.character?.map((e: { tag: any }) => e.tag) || []),
      ...(data.general?.map((e: { tag: any }) => e.tag) || []),
    ]
    data.postView = `https://nozomi.la/post/${data.postid}.html`
    data.previewUrl = `https://qtn.gold-usergeneratedcontent.net/${full_path_from_hash(data.imageurls[0].dataid)}.${data.imageurls[0].type}.webp`
    const url = data.imageurls[0]
    if (url.is_video) {
      data.fileUrl = `https://v.gold-usergeneratedcontent.net/${full_path_from_hash(url.dataid)}.${url.type}`
    } else {
      data.fileUrl = `https://${url.type === 'gif' ? 'g' : 'w'}.gold-usergeneratedcontent.net/${full_path_from_hash(url.dataid)}.${url.type === 'gif' ? 'gif' : 'webp'}`
    }
  }
  resPosts = datas
}
