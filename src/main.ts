import '@/styles/normalize.css'
import 'vuetify/dist/vuetify.min.css'
import '@/styles/custom.css'

import Vue from 'vue'
import VueMasonry from '@himeka/masonry-css'
import TrueMasonry from '@himeka/masonry-true'
import VirtualWaterfall from '@himeka/virtual-waterfall'
import installVuetify from './plugins/vuetify'
import i18n from './utils/i18n'
import WfLayout from './components/WfLayout.vue'
import App from './App.vue'
import { toApiProxyUrl } from '@/api/gateway'

// @himeka/booru 包内的 search() 用全局 fetch 直连目标站，浏览器侧必然跨域失败。
// 用包自带的全局钩子 BOORU_FETCH_PROXY（searchURI 构建时包装 URI）接管包内请求。
// 复用 gateway 的 toApiProxyUrl 而非写死 /proxy?url=：它每次调用都读 settings.apiProxy
// 与 serverBase()，这样切换 API 代理（或自定义 __apiServer）后包站立即跟随，
// 与走 apiFetch 的本地适配器行为一致（替代旧的 window.fetch 全局 patch——
// patch 会误伤第三方 https 请求，删除见计划 3.3）。
globalThis.BOORU_FETCH_PROXY = (uri: string) => toApiProxyUrl(uri)

Vue.component('Masonry', VueMasonry)
Vue.component('TrueMasonry', TrueMasonry)
Vue.component('VirtualWaterfall', VirtualWaterfall)
Vue.component('WfLayout', WfLayout)
const vuetify = installVuetify()
const app = new Vue({
  vuetify,
  i18n,
  render: h => h(App),
})
app.$mount('#app')

// 标签翻译数据：随脚本版构建管线（yandere-masonry/src/data/handle-tags.mjs）产出，
// 按计划 3.3 本地打包、不再运行时拉 CDN；动态 import 生成独立懒 chunk，仅中文环境加载。
// 数据更新方式：从脚本版仓库重新拷贝这两个 min.json。
// - __tagsCN      ← all_tags_cn.min.json（原样键，moebooru 系用）
// - __tagsCNSpace ← all_tags_cn_space.min.json（空格键，danbooru / e-shuushuu 用）
// 注：旧文件 tags_cn.json 在脚本版已废弃，不再使用。
if (navigator.language.includes('zh')) {
  import('./data/all_tags_cn.min.json')
    .then(m => { window.__tagsCN = m.default })
  import('./data/all_tags_cn_space.min.json')
    .then(m => { window.__tagsCNSpace = m.default })
}
