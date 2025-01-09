import '@/styles/custom.css'
import '@/plugins/fetch'

import Vue from 'vue'
import VueCompositionAPI from '@vue/composition-api'
import VueMasonry from 'vue-masonry-css'
import installVuetify from './plugins/vuetify'
import App from './App.vue'

Vue.use(VueCompositionAPI)
Vue.use(VueMasonry)
const vuetify = installVuetify()
const app = new Vue({
  vuetify,
  render: h => h(App),
})
app.$mount('#app')

if (location.host.includes('pixiv.pics')) {
  const res = confirm('The current domain name is no longer in use. Would you like to visit another domain name instead?')
  if (res) {
    location.href = 'https://booru.cocomi.eu.org'
  }
}
