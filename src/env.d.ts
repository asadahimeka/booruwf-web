/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/ban-types
  const component: DefineComponent<{}, {}, any>
  export default component
}

declare module 'vuetify/lib/framework' {
  import 'vuetify/types'
  import Vuetify from 'vuetify'
  export default Vuetify
}

declare module 'vue-masonry-css' {
  import Vue from 'vue'
  export default {
    install(app: typeof Vue): void
  }
}
