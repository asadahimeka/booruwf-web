import { URL, fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import { createVuePlugin as Vue2 } from 'vite-plugin-vue2'
import { createHtmlPlugin as Html } from 'vite-plugin-html'
import { viteExternalsPlugin as Externals } from 'vite-plugin-externals'
import ScriptSetup from 'unplugin-vue2-script-setup/vite'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    // https://github.com/underfin/vite-plugin-vue2
    Vue2({ target: 'esnext' }),
    // https://github.com/crcong/vite-plugin-externals
    Externals({
      'vue': 'Vue',
      'vuetify': 'Vuetify',
      '@vue/composition-api': 'VueCompositionAPI',
      'vue-masonry-css': 'VueMasonry',
    }, { disableInServe: true }),
    // https://github.com/vbenjs/vite-plugin-html
    Html({
      minify: true,
      entry: 'src/main.ts',
      inject: {
        data: {
          cdnCss: [
            'https://lib.baomitu.com/normalize/8.0.1/normalize.min.css',
            'https://fonts.googleapis.com/css?family=Roboto:100,300,400,500,700,900',
            'https://lib.baomitu.com/vuetify/2.6.9/vuetify.min.css',
          ],
          cdnJs: [
            'https://lib.baomitu.com/vue/2.6.14/vue.min.js',
            'https://unpkg.com/@vue/composition-api@1.7.0/dist/vue-composition-api.prod.js',
            'https://lib.baomitu.com/vuetify/2.6.9/vuetify.min.js',
            'https://code.bdstatic.com/npm/vue-masonry-css@1.0.3/dist/vue-masonry.min.js',
          ],
        },
      },
    }),
    // https://github.com/antfu/unplugin-vue2-script-setup
    ScriptSetup(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('src', import.meta.url)),
    },
  },
})
