import { URL, fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue2'
import { VitePWA } from 'vite-plugin-pwa'

// https://vitejs.dev/config/
// M0 起不再有 CDN externals：Vue/Vuetify/vue-i18n 等全部本地打包，
// 由 server/（Hono）托管 dist/ 产物；dev 模式经 proxy 联调本地 Hono。
export default defineConfig({
  plugins: [
    // https://github.com/vitejs/vite/tree/main/packages/plugin-vue2
    vue(),
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
        // 导航请求（地址栏直接打开 / 新标签页打开接口地址）默认全部回退 index.html，
        // 服务端端点必须排除，否则直接访问 /proxy?url= /img?url= /dl?url= 会被
        // SW 接管并返回 SPA 页面
        navigateFallbackDenylist: [/^\/proxy/, /^\/img/, /^\/dl/],
        runtimeCaching: [
          {
            // 必须排在所有缓存规则之前：workbox 按注册顺序匹配路由。
            // 注意 RegExpRoute 对 **完整 href** 匹配（含协议与域名），写 /^\/proxy/
            // 永远匹配不上 —— /img?url=...jpg 结尾的 .jpg 会被下面的 media-cache
            // CacheFirst 截胡，代理图被 SW 长期缓存、更新失效
            urlPattern: /\/(?:proxy|img|dl)\?/,
            handler: 'NetworkOnly',
          },
          {
            urlPattern: /.*\.html$/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'html-cache',
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /.*\.(css|js)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'css-js-cache',
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // 静态媒体文件（不含代理路径：上面已由 NetworkOnly 先行拦截）
            urlPattern: /.*\.(png|gif|jpg|jpeg|ico|svg|mp4|webp|avif)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'media-cache',
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('src', import.meta.url)),
      // Vue 2.7 的 exports 同时暴露 import->vue.runtime.mjs(转发 CJS) 与 default->vue.runtime.esm.js
      // 两条路径，不同包解析到不同入口会打出两份 Vue（vuetify 报 Multiple instances of Vue detected）。
      // 这里统一钉死到唯一 ESM 入口。
      'vue': fileURLToPath(new URL('node_modules/vue/dist/vue.runtime.esm.js', import.meta.url)),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // 按「变更频率」分包：vuetify 这些库基本不动，拆出来后业务代码
        // 迭代只会让主 chunk 失效，浏览器/Service Worker 的 css-js-cache
        // （CacheFirst）可以长期复用库 chunk
        manualChunks(id: string) {
          if (!id.includes('node_modules')) return
          if (id.includes('vuetify')) return 'vuetify'
          if (id.includes('dplayer')) return 'dplayer'
          if (id.includes('@fancyapps')) return 'fancybox'
          // vue/vue-i18n/vue-demi 不再单独拆：interop 辅助函数会被 rollup
          // 提到其它 chunk，细拆会产生 vendor ↔ vue-vendor 的 chunk 环
          return 'vendor'
        },
      },
    },
  },
  server: {
    proxy: {
      // 本地 Hono 服务端（server/），见 server/package.json scripts.dev
      '/proxy': 'http://127.0.0.1:8787',
      '/img': 'http://127.0.0.1:8787',
      '/dl': 'http://127.0.0.1:8787',
    },
  },
})
