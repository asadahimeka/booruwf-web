import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  retries: 1,
  use: {
    baseURL: 'http://127.0.0.1:8787',
    locale: 'zh-CN',
  },
  webServer: {
    command: 'pnpm server:start',
    port: 8787,
    reuseExistingServer: true,
    timeout: 30_000,
    cwd: '.',
    // 本机 Clash 默认端口：danbooru 等被上游 403 的站点需要走代理。
    // 无代理环境可设 UPSTREAM_PROXY="" 跳过，相关用例会失败。
    env: { UPSTREAM_PROXY: process.env.UPSTREAM_PROXY ?? 'http://127.0.0.1:7890' },
  },
})
