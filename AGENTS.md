# AGENTS.md

面向 AI 编码助手的项目指南。开工前请先阅读本文件，遵循其中的命令与约定。

## ⚠️ CRITICAL RULES

### Never Modify Code Without Explicit Request
- **INVESTIGATE ≠ IMPLEMENT**. "look into", "check", "find" → report only.
- "explain", "how does X work" → answer only.
- Do not write code, edit files, or create features unless explicitly asked.

### Never Delete Files Without Explicit Request
- "revert" → revert changes with `git restore`, not delete files.
- When in doubt → ask.

### Never Commit to Git Without Explicit Request
- Do not stage, commit, or push changes unless the user directly says "commit" or "push".
- Even if work is complete, wait for instruction.

---

## Pre-Implementation Protocol

Before writing any code or modifying any file, you MUST follow this protocol:

### Step 1 — Restate Understanding
In your own words, explain:
- What problem you're solving and what the deliverable is.
- Any assumptions you're making or things you're uncertain about.
- If you see a better technical approach, propose it — the user decides.

### Step 2 — Ask Key Questions
Ask no more than **3** questions until you have 100% clarity on:
1. **The real goal** — what the user actually wants to achieve (not just what they said).
2. **Unstated constraints** — tech stack limits, performance requirements, code that must not be touched, etc.
3. **Your implementation plan** — core approach, why this solution, what tradeoffs exist.

### Step 3 — Wait for Go-Ahead
**Do not write code or modify files** until the user explicitly says to proceed.

---

## 项目概览

**booruwf-web** — Booru 站点瀑布流（masonry）浏览聚合 & 标签中文翻译，PWA 应用。

- 前端：Vue 2.7（Composition API）+ Vuetify 2.7 + vue-i18n 8 + Vite 5 + TypeScript 4.9
- 服务端：`server/` — Hono 网关（Node/Deno/Bun 三运行时），静态托管 `dist/` + 代理转发
- 包管理：**只允许 pnpm**（`preinstall` 有 `only-allow pnpm` 拦截），pnpm workspace
- 路径别名：`@` → `src/`

## 常用命令

```bash
pnpm install                # 安装依赖（workspace: 根 + packages/* + server）

pnpm dev                    # 前端 dev server（/proxy /img /dl 代理到本地 8787 Hono）
pnpm -C server dev          # 服务端 dev（tsx watch，默认 127.0.0.1:8787）

pnpm check                  # 类型检查（vue-tsc --noEmit），改动后必须通过
pnpm lint                   # ESLint（src 下 .ts/.vue）
pnpm build                  # 前端构建到 dist/
pnpm test                   # Playwright E2E（自动拉起 server:start，需先 pnpm build）

pnpm -C server check        # 服务端类型检查（tsc --noEmit）
pnpm -C server smoke        # 服务端冒烟测试
node scripts/generate-allowed-domains.mjs   # 重新生成服务端域名白名单
```

## 目录结构

```
src/
  api/          # 各站点 API 适配器（每站一个 .ts），sites.ts 为站点注册表，gateway.ts 为统一入口
  components/   # Vue 组件（AppBar / PostList / PostDetail / NavDrawer / SettingsDrawer 等）
  store/        # Pinia 风格 store（actions/ 下按 detail/post/site 拆分）
  locales/      # i18n：en / ja / zh-Hans / zh-Hant，新增文案需四种语言同步补齐
  plugins/      # vuetify、webfontloader
  utils/        # 工具（download-source、filename、overlay-history 等）
  data/         # 标签中文翻译 JSON（.min.json，勿手改格式）
packages/       # workspace 内部包
  booru/                    # @himeka/booru —— 站点 API 库，sites.json 为站点源数据
  true-masonry/             # @himeka/masonry-true
  vue-masonry-css/          # @himeka/masonry-css
  vue-virtual-waterfall/    # @himeka/virtual-waterfall
  release/                  # @himeka/release 发版工具
server/
  src/core/     # proxy / img / dl / allowed-domains / sites / runtime
  src/entry/    # node.ts / bun.ts / deno.ts / curl-fetch.ts 各运行时入口
scripts/        # generate-allowed-domains.mjs、release.mjs
e2e/            # Playwright 用例
```

## 服务端网关（关键机制）

浏览器无法直连各 booru 站，所有请求经 Hono 中转：

- `GET /proxy?url=` — API / HTML 通用转发
- `GET /img?url=` — 图片代理
- `GET /dl?url=` — 下载代理（Content-Disposition 附件）
- 目标域名白名单由 `packages/booru/sites.json` + `server/src/core/sites.ts` 派生；改动任一后必须运行 `node scripts/generate-allowed-domains.mjs` 重新生成 `server/src/core/allowed-domains.ts`
- 可选环境变量：`PORT`、`UPSTREAM_PROXY`（上游 HTTP 代理，undici ProxyAgent）

## PWA / Service Worker 陷阱

`vite.config.ts` 中 workbox 配置有严格顺序依赖，改动前务必理解：

- `navigateFallbackDenylist` 排除 `/proxy` `/img` `/dl`，否则直接访问这些端点会被 SW 接管返回 SPA 页面
- 代理路径（`/\/(?:proxy|img|dl)\?/`）的 **NetworkOnly 规则必须排在所有缓存规则之前**（workbox 按注册顺序匹配）；且正则匹配的是完整 href，不能写成 `^\/proxy/` 这种路径形式
- 手动分包 manualChunks 按「变更频率」拆 vuetify / dplayer / fancybox / vendor，勿随意合并（会破坏 CacheFirst 长缓存）

## Vue 2.7 注意事项

- `vite.config.ts` 把 `vue` 别名钉死到 `node_modules/vue/dist/vue.runtime.esm.js`，避免打出两份 Vue（vuetify 会报 Multiple instances of Vue detected），**勿删除或改动**
- tsconfig 有 `importsNotUsedAsValues: "error"` —— 类型导入必须写 `import type`
- `vueCompilerOptions.target: 2.7`，不能用 Vue 3 独有语法（如 `<script setup>` 之外的 Vue3 API、多根节点等）
- SFC 块顺序：`script` → `template` → `style`

## 代码风格

ESLint 基于 `@antfu/eslint-config-vue` + 项目级覆盖：

- **无分号**、单引号、`arrow-parens: as-needed`、1tbs 花括号风格
- `curly: multi-line`（单行 if 可省略花括号）
- 提交前跑 `pnpm lint && pnpm check`，两者必须零错误

## 返回键关闭覆盖层（history 模式）

移动端返回键关闭弹窗/抽屉统一走 `src/utils/overlay-history.ts` 的 `useBackClose(isOpen, close)`：
打开覆盖层时 pushState 哨兵，popstate 时关闭最上层；哨兵增减合并到微任务做账目同步。
新增弹窗/抽屉需要支持返回键关闭时，接入此模式，不要自行 pushState。

## E2E 测试

- `pnpm test` 会通过 webServer 配置自动拉起 `server:start`（8787），无需手动启动
- 本机默认假设 Clash 代理 `http://127.0.0.1:7890`（danbooru 等被上游 403 的站点需要走代理）；无代理环境设 `UPSTREAM_PROXY=""`，相关用例会失败属预期
- `fullyParallel: false`，用例间有顺序依赖

## 其他约定

- 代码注释与提交信息使用中文，注释重点解释「为什么」而非「是什么」
- 改 `packages/booru/sites.json` 或新增站点适配器时：同步检查 `src/api/sites.ts` 注册表与域名白名单再生成
- `src/data/*.min.json` 为压缩过的翻译数据，不要手动编辑其格式
- 发版走 `pnpm release`（scripts/release.mjs），不要手动改版本号发布
