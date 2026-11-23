import { expect, test } from '@playwright/test'

test.describe('应用基础', () => {
  test('首页加载并渲染应用壳', async ({ page }) => {
    await page.goto('/')
    // 应用挂载后加载占位符会被替换
    await expect(page.locator('#loading')).toHaveCount(0, { timeout: 20_000 })
    // Vuetify 应用布局存在
    await expect(page.locator('.v-application')).toBeVisible()
  })

  test('静态资源与 PWA manifest 可访问', async ({ request }) => {
    const res = await request.get('/')
    expect(res.ok()).toBeTruthy()
    const html = await res.text()
    expect(html).toContain('manifest')
    const manifest = await request.get('/manifest.webmanifest')
    // vite-plugin-pwa 产物
    expect(manifest.status()).toBe(200)
    // SPA fallback：任意路径返回 index.html
    const fallback = await request.get('/some/unknown/path')
    expect(fallback.status()).toBe(200)
    expect(await fallback.text()).toContain('<div id="app">')
  })
})

test.describe('服务端网关', () => {
  test('healthz', async ({ request }) => {
    const res = await request.get('/healthz')
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(typeof body.ts).toBe('number')
  })

  test('白名单内 API 转发：yande.re 版本号', async ({ request }) => {
    const res = await request.get(
      `/proxy?url=${encodeURIComponent('https://yande.re/post.json?limit=1&page=1&tags=order:id')}`,
    )
    expect(res.ok()).toBeTruthy()
    const data = await res.json()
    expect(Array.isArray(data)).toBeTruthy()
    expect(data.length).toBeGreaterThan(0)
    expect(data[0].id).toBeTruthy()
  })

  test('白名单外域名被拒绝', async ({ request }) => {
    const res = await request.get(
      `/proxy?url=${encodeURIComponent('https://example.com/whatever')}`,
    )
    expect(res.status()).toBe(403)
    expect((await res.json()).error).toContain('domain not allowed')
  })

  test('TLS 指纹封锁域名走 curl 回退：danbooru', async ({ request }) => {
    // Cloudflare 对 Node fetch 的 JA3 指纹返回 403；服务端对这批域名
    // 改走 curl 子进程（见 server/src/entry/curl-fetch.ts）
    const res = await request.get(
      `/proxy?url=${encodeURIComponent('https://danbooru.donmai.us/posts.json?tags=&limit=3&page=1')}`,
    )
    expect(res.ok()).toBeTruthy()
    const data = await res.json()
    expect(Array.isArray(data)).toBeTruthy()
    expect(data[0].id).toBeTruthy()
  })

  test('TLS 指纹封锁域名走 curl 回退：e621 项目 UA', async ({ request }) => {
    // e621 应用层政策要求 UA 报明项目身份（见 core/sites.ts 的 PROJECT_UA）
    const res = await request.get(
      `/proxy?url=${encodeURIComponent('https://e621.net/posts.json?tags=&limit=1&page=1')}`,
    )
    expect(res.ok()).toBeTruthy()
    const data = await res.json()
    expect(Array.isArray(data)).toBeTruthy()
  })

  test('图片代理管线可达（防盗链伪装头生效）', async ({ request }) => {
    // konachan sample 图（公网真实存在的地址），仅断言管线状态 < 500
    const res = await request.get(
      `/img?url=${encodeURIComponent('https://konachan.com/data/preview/0000/0001.jpg')}`,
    )
    // 上游可能是 403/404（文件不存在），但绝不能是我们这边 5xx
    expect(res.status()).toBeLessThan(500)
  })
})

test.describe('站点选择与列表', () => {
  test('?site=yande.re 加载瀑布流帖子', async ({ page }) => {
    await page.goto('/?site=yande.re')
    await expect(page.locator('#loading')).toHaveCount(0, { timeout: 20_000 })
    // 等待真实帖子卡片渲染（v-img 以背景图方式展示，经由浏览器直接拉取图片 CDN）
    await page.waitForSelector('.v-image__image[style*="background-image"]', { timeout: 30_000 })
    // 若拉取失败应用会弹 Snackbar 错误提示——不应出现
    await page.waitForTimeout(1500)
    const snackbar = await page.locator('.v-snack--active').count()
    expect(snackbar).toBe(0)
  })

  // danbooru / e621 已通过服务端 curl 回退解决（见「服务端网关」用例），
  // 这里验证包站通用适配器在真实站点上可用
  test('?site=danbooru.donmai.us 包站通用搜索（booruAction）', async ({ page }) => {
    await page.goto('/?site=danbooru.donmai.us')
    await expect(page.locator('#loading')).toHaveCount(0, { timeout: 20_000 })
    await page.waitForSelector('.v-image__image[style*="background-image"]', { timeout: 40_000 })
    const snackbar = await page.locator('.v-snack--active').count()
    expect(snackbar).toBe(0)
  })

  // 回归：包站通用适配器走 BOORU_FETCH_PROXY 全局钩子，曾写死默认 /proxy?url=，
  // 导致切换 apiProxy 后仍打默认代理。这里拦截自定义前缀代理并断言 yande.re 搜索命中它。
  test('切换 API 代理后包站通用适配器（booruAction）走新代理', async ({ page, context }) => {
    const proxyPrefix = 'https://fake-proxy.test/'
    await context.addInitScript((prefix) => {
      localStorage.setItem('YM_APP_SETTINGS', JSON.stringify({ apiProxy: prefix }))
    }, proxyPrefix)

    let resolveHit!: () => void
    const hit = new Promise<void>((resolve) => { resolveHit = resolve })
    await page.route(url => url.hostname === 'fake-proxy.test', async (route) => {
      if (route.request().url().includes('yande.re')) resolveHit()
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'access-control-allow-origin': '*' },
        body: '[]',
      })
    })

    await page.goto('/?site=yande.re')
    // 若仍走默认 /proxy?url=，fake-proxy.test 不会被请求，这里超时失败
    await hit
  })

  test('?site=gelbooru.com&path=... HTML 适配器（apiFetch → /proxy）', async ({ page }) => {
    await page.goto(`/?site=gelbooru.com&path=${encodeURIComponent('/index.php?page=post&s=list')}`)
    await expect(page.locator('#loading')).toHaveCount(0, { timeout: 20_000 })
    await page.waitForSelector('.v-image__image[style*="background-image"]', { timeout: 40_000 })
    const snackbar = await page.locator('.v-snack--active').count()
    expect(snackbar).toBe(0)
  })

  // rule34.xxx 现挂 Cloudflare 挑战，服务端 fetch 无法通过（脚本版靠宿主页面 cookie），
  // 属计划内 P2 限制，E2E 不覆盖；适配器代码保留，网络可达时可用。

  test('?site=yande.re&path=/pool/show/1 pool 页适配器', async ({ page }) => {
    await page.goto(`/?site=yande.re&path=${encodeURIComponent('/pool/show/1')}`)
    await expect(page.locator('#loading')).toHaveCount(0, { timeout: 20_000 })
    await page.waitForSelector('.v-image__image[style*="background-image"]', { timeout: 40_000 })
    const snackbar = await page.locator('.v-snack--active').count()
    expect(snackbar).toBe(0)
  })

  test('?site=yande.re&path=/post/popular_by_week popular 页适配器', async ({ page }) => {
    await page.goto(`/?site=yande.re&path=${encodeURIComponent('/post/popular_by_week')}`)
    await expect(page.locator('#loading')).toHaveCount(0, { timeout: 20_000 })
    await page.waitForSelector('.v-image__image[style*="background-image"]', { timeout: 40_000 })
    const snackbar = await page.locator('.v-snack--active').count()
    expect(snackbar).toBe(0)
  })

  // 文章页 / 相册页卡片点击应打开应用内 ?site=&path= 视图（web 版源站页无脚本接管）
  // everia 全站 rating 'e'，需先开启 NSFW（默认关闭，见 store/settings.ts）
  test('everia 列表卡片打开应用内文章页视图', async ({ page, context }) => {
    await context.addInitScript(() => {
      localStorage.setItem('YM_APP_SETTINGS', JSON.stringify({ showNSFWContents: true }))
    })
    await page.goto('/?site=everia.club')
    await expect(page.locator('#loading')).toHaveCount(0, { timeout: 20_000 })
    await page.waitForSelector('.posts-image-card', { timeout: 40_000 })
    const popupPromise = page.waitForEvent('popup')
    await page.locator('.posts-image-card .v-image').first().click()
    const popup = await popupPromise
    await popup.waitForLoadState('domcontentloaded')
    const url = new URL(popup.url())
    expect(url.searchParams.get('site')).toBe('everia.club')
    expect(url.searchParams.get('path')).toMatch(/^\/\d{4}\/\d{2}\/\d{2}\//)
  })
})
