# booruwf-server

booruwf-web 的配套服务端：同源静态托管 `dist/` 产物 + `/proxy` `/img` `/dl` 代理网关。

- 运行时：Node / Bun / Deno（Hono，行为三端一致）
- 域名白名单由 `packages/booru/sites.json` + `src/core/sites.ts` 派生，
  改动后重新生成：`node scripts/generate-allowed-domains.mjs`

```bash
pnpm -C server dev        # 开发（tsx watch）
pnpm -C server start      # Node 运行时，默认 http://127.0.0.1:8787
pnpm -C server start:bun  # Bun 运行时
pnpm -C server start:deno # Deno 运行时
pnpm -C server check      # 类型检查（tsc --noEmit）
pnpm -C server smoke      # 冒烟测试（需先启动服务端）
```

## .env 文件

支持在 `server/.env` 配置环境变量（示例见 [.env.example](./.env.example)）：

- Bun / Deno 运行时自动加载 .env；Node 由 `src/lib/env.ts` 轻量加载器补齐
- 优先级：CLI / shell 环境变量 > `.env` 文件（已有变量不会被覆盖）
- `.env` 已加入 .gitignore，密钥类配置不要提交

## 目录结构

```
server/src/
  core/          # 装配（index.ts）+ 域名规则（sites.ts）+ 上游 fetch 抽象（runtime.ts）
                 # allowed-domains.ts 为生成产物（scripts/generate-allowed-domains.mjs），勿手改
  middlewares/   # Hono 中间件：logger / rate-limit / blocker
  handlers/      # 路由处理器：proxy / img / dl
  lib/           # 通用库：sanitize / request-deduper / ssrf-guard / env / curl-fetch
  entry/         # 各运行时入口：node / bun / deno
  tests/         # smoke.ts 冒烟测试
```

约束：`core/` 只用 Web 标准 API（三运行时一致）；依赖 node: 专属模块的文件
（如 `lib/curl-fetch.ts`）只能被对应运行时的 entry 引入。

端点说明见根目录 README。中间件链（自上而下）：

1. 请求日志（URL 脱敏）
2. IP 限流（`rate-limit.ts`，回环豁免）
3. secureHeaders
4. 代理端点拦截（`blocker.ts`：UA 黑名单 / isbot / Origin-Referer 白名单，回环豁免）
5. SSRF 校验（`ssrf-guard.ts`：私网 / 元数据端点 / IP-echo / DNS rebinding）
6. 并发去重（`request-deduper.ts`：GET `/proxy` 相同请求合并）

## 环境变量

### 基础

| 变量 | 默认 | 说明 |
|---|---|---|
| `PORT` | `8787` | 监听端口 |
| `UPSTREAM_PROXY` | — | 上游 HTTP 代理（undici ProxyAgent），也可用标准 `HTTPS_PROXY` / `HTTP_PROXY`。danbooru 等被出口 403 的站点需要走代理 |
| `CURL_FALLBACK_HOSTS` | `danbooru.donmai.us,aibooru.online,e621.net,e926.net` | Node 下 TLS 指纹被 Cloudflare 封锁的域名改走 curl 子进程；设为空串关闭回退 |
| `IMG_ALLOW_ANY_HOST` | `1` | `/img` 是否放开到「语法合法的公网 https 域」（图床域名常整批更换）。设为 `0` 回到纯白名单模式（自定义站点域仍可用 `claim` 参数放行） |

### 限流（`rate-limit.ts`）

| 变量 | 默认 | 说明 |
|---|---|---|
| `RATE_LIMIT_ENABLED` | `1` | 设为 `0` 关闭限流 |
| `RATE_LIMIT_WINDOW_MS` | `60000` | 固定窗口长度（毫秒） |
| `RATE_LIMIT_MAX` | `120` | 窗口内单 IP 最大请求数，超限返回 429 + Retry-After |
| `TRUST_PROXY` | `0` | `true` 时信任 `x-real-ip` / `x-forwarded-for`（取最右段）。仅在部署于自家反代之后时开启，否则客户端可伪造头绕过限流 |
| `TRUST_CLOUDFLARE` | `0` | `true` 时信任 `cf-connecting-ip` 头（Cloudflare 部署） |

> 回环地址（127.0.0.1 / ::1）的请求始终豁免限流与拦截：本地 dev、smoke、e2e 不受影响，防护只作用于公网。

### 代理端点拦截（`blocker.ts`）

| 变量 | 默认 | 说明 |
|---|---|---|
| `ACCEPT_DOMAINS` | 空（不校验） | 逗号分隔的来源域白名单，校验 `Origin` / `Referer`，支持 `*.example.com` 通配。**公网部署建议配置为自己的部署域** |
| `UA_BLACKLIST` | 空 | 逗号分隔的额外 UA 关键词黑名单（大小写不敏感，子串匹配） |

内置拦截（无需配置）：空 UA、isbot 识别的爬虫 UA 一律 403。

### SSRF 防护（`ssrf-guard.ts`）

`/proxy` `/img` `/dl` 在域名白名单之外再做一层纵深防御：

- 拒绝私网 / 回环 / 链路本地地址（含 IPv6、IPv4-mapped 形态）
- 拒绝云元数据端点（`169.254.169.254` 等）
- 拒绝 IP-echo 服务（`ifconfig.me`、`ipinfo.io` 等 30+ 内置黑名单，防止网关被当出口 IP 探测 oracle）
- 非 IP 字面量域名先做 DNS 解析校验，解析结果落在私网即拒绝（防 nip.io / DNS rebinding）

| 变量 | 默认 | 说明 |
|---|---|---|
| `PROXY_ALLOW_DOMAINS` | 空 | 额外域白名单（逗号分隔，支持 `*.`），配置后仅放行名单内域名 |
| `PROXY_BLOCK_DOMAINS` | 空 | 额外域黑名单（逗号分隔，支持 `*.`） |
| `PROXY_ALLOW_IP_ECHO` | `0` | 设为 `1` 关闭内置 IP-echo 黑名单 |
| `SSRF_DNS_CHECK` | `1` | 设为 `0` 关闭 DNS 解析校验（上游代理解析 DNS、本地 DNS 异常等场景） |

### 并发去重（`request-deduper.ts`）

GET `/proxy` 的相同请求在并发到达时只打一次上游（瀑布流首屏防触发上游风控）。与 `proxy.ts` 内置的 60s 内存缓存互补：缓存挡「已完成」的重复，去重挡「进行中」的重复。

| 变量 | 默认 | 说明 |
|---|---|---|
| `DEDUPER_MAX` | `500` | 去重队列容量上限，超过直接报错（防并发风暴撑爆内存） |
| `DEDUP_BODY_MAX` | `5242880` | 可共享响应体的字节上限；超限响应（如大文件）不缓冲，各请求直连透传 |

## 部署示例

```bash
# 公网部署（Cloudflare 或自家反代之后）
PORT=8787 \
TRUST_CLOUDFLARE=true \
ACCEPT_DOMAINS=booru.example.com \
RATE_LIMIT_MAX=120 \
pnpm -C server start

# 本机 + Clash 上游代理
UPSTREAM_PROXY=http://127.0.0.1:7890 pnpm -C server start
```
