# booruwf-web

![](https://img.shields.io/github/package-json/v/asadahimeka/booruwf-web)
![](https://img.shields.io/badge/license-MIT-green)
![](https://img.shields.io/github/package-json/dependency-version/asadahimeka/booruwf-web/dev/vite)
![](https://img.shields.io/github/package-json/dependency-version/asadahimeka/booruwf-web/@himeka/booru)
![](https://img.shields.io/github/package-json/dependency-version/asadahimeka/booruwf-web/vue)
![](https://img.shields.io/github/package-json/dependency-version/asadahimeka/booruwf-web/vuetify)

Booru sites masonry browsing mode.

Booru 站点瀑布流浏览聚合 & 标签中文翻译。

Build with [vite](https://vitejs.dev)

## Preview

Web 版本: [点击预览](https://booru.vercel.app)

用户脚本版本: [点击安装](https://greasyfork.org/zh-CN/scripts/444885)

## Screenshots

![](https://upload-bbs.mihoyo.com/upload/2022/08/13/260511332/3886bf873b766f93e3cd103c0346705f_8954181707521812180.png)

![](https://upload-bbs.mihoyo.com/upload/2022/08/13/260511332/f18495ec74cf7895da6a583b6eef5815_2183319892513327746.png)

![](https://upload-bbs.mihoyo.com/upload/2022/08/13/260511332/59a35c4b527ec44904a6114a45033caf_7008024359546939405.png)

![](https://upload-bbs.mihoyo.com/upload/2022/08/13/260511332/c7c1ff0b187292ebc010fd40987ad52a_6882591913629167774.png)

## Developing

```bash
git clone https://github.com/asadahimeka/booruwf-web.git
cd booruwf-web
pnpm install
pnpm dev          # 前端（vite，代理 /proxy /img /dl 到本地 Hono）
pnpm -C server dev  # 服务端（Hono，Node 运行时，默认 8787）
pnpm build        # 前端构建（prebuild 先跑 vue-tsc）
pnpm test         # Playwright E2E（自动拉起服务端与前端产物）
```

### Deployment

浏览器无法直连各 booru 站，web 版通过自带 Hono 服务端中转：

- `GET /proxy?url=` —— API / HTML 通用转发
- `GET /img?url=` —— 图片代理
- `GET /dl?url=` —— 下载代理（Content-Disposition 附件）
- 同源静态托管 `dist/` 产物 + SPA fallback，单进程部署

```bash
pnpm build            # 先构建前端产物到 dist/
pnpm -C server start  # Node：http://127.0.0.1:8787
pnpm -C server start:bun    # Bun 运行时
pnpm -C server start:deno   # Deno 运行时
```

可选环境变量：`PORT`（监听端口）、`UPSTREAM_PROXY`（上游 HTTP 代理，undici ProxyAgent）。
完整环境变量说明（限流 / 来源拦截 / SSRF 防护 / 并发去重等）见 [server/README.md](./server/README.md)。
目标域名白名单由 `packages/booru/sites.json` + `server/src/core/sites.ts` 派生，
重新生成：`node scripts/generate-allowed-domains.mjs`。

## License

Modified from [yandere-masonry](https://github.com/asadahimeka/yandere-masonry)

Licensed under the [MIT](https://github.com/asadahimeka/booruwf-web/blob/main/LICENSE) license

Copyright © 2022 Yumine Sakura
