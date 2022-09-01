import { URL, fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import { createVuePlugin as Vue2 } from 'vite-plugin-vue2'
import { createHtmlPlugin as Html } from 'vite-plugin-html'
import ScriptSetup from 'unplugin-vue2-script-setup/vite'
import externalGlobals from 'rollup-plugin-external-globals'

const cdnMap = {
  'vue': 'Vue',
  'vuetify': 'Vuetify',
  '@vue/composition-api': 'VueCompositionAPI',
  'vue-masonry-css': 'VueMasonry',
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    // https://github.com/underfin/vite-plugin-vue2
    Vue2({ target: 'esnext' }),
    // https://github.com/vbenjs/vite-plugin-html
    Html({ minify: true }),
    // https://github.com/antfu/unplugin-vue2-script-setup
    ScriptSetup(),
  ],
  build: {
    rollupOptions: {
      external: Object.keys(cdnMap),
      plugins: [
        externalGlobals(cdnMap),
      ],
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('src', import.meta.url)),
    },
  },
})
