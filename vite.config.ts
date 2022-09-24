import { URL, fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import { createVuePlugin as Vue2 } from 'vite-plugin-vue2'
import { createHtmlPlugin as Html } from 'vite-plugin-html'
import { viteExternalsPlugin as Externals } from 'vite-plugin-externals'
import ScriptSetup from 'unplugin-vue2-script-setup/vite'
import { VitePWA } from 'vite-plugin-pwa'

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
            'https://unpkg.com/normalize.css@8.0.1/normalize.css',
            'https://fonts.googleapis.com/css?family=Roboto:100,300,400,500,700,900',
            'https://unpkg.com/vuetify@2.6.10/dist/vuetify.min.css',
          ],
          cdnJs: [
            'https://unpkg.com/vue@2.6.14/dist/vue.min.js',
            'https://unpkg.com/@vue/composition-api@1.7.0/dist/vue-composition-api.prod.js',
            'https://unpkg.com/vuetify@2.6.10/dist/vuetify.min.js',
            'https://unpkg.com/vue-masonry-css@1.0.3/dist/vue-masonry.min.js',
          ],
        },
      },
    }),
    // https://github.com/antfu/unplugin-vue2-script-setup
    ScriptSetup(),
    // https://github.com/antfu/vite-plugin-pwa
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'pwa-192x192.png', 'pwa-256x256.png'],
      manifestFilename: 'manifest.json',
      manifest: {
        name: 'Booru Masonry',
        short_name: 'booruwf',
        description: 'Browsing booru sites with masonry layout.',
        theme_color: '#B28FCE',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'pwa-256x256.png',
            sizes: '256x256',
            type: 'image/png',
          },
        ],
      },
      workbox: {
        skipWaiting: true,
        clientsClaim: true,
        runtimeCaching: [
          {
            urlPattern: /.*\.css/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'css-cache',
              cacheableResponse: {
                statuses: [200],
              },
            },
          },
          {
            urlPattern: /.*\.js/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'js-cache',
              cacheableResponse: {
                statuses: [200],
              },
            },
          },
          {
            urlPattern: /.*\.(png|gif|jpg|jpeg|svg)/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'image-cache',
              cacheableResponse: {
                statuses: [200],
              },
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 31536000,
              },
            },
          },
          {
            urlPattern: /^https:\/\/(lib\.baomitu\.com|unpkg\.com|googleapis\.com|code\.bdstatic\.com)/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'cdn-cache',
              cacheableResponse: {
                statuses: [200],
              },
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 31536000,
              },
              fetchOptions: {
                credentials: 'include',
              },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('src', import.meta.url)),
    },
  },
})
