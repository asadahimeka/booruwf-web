# booruwf-web

![](https://img.shields.io/github/package-json/v/asadahimeka/booruwf-web)
![](https://img.shields.io/badge/license-MIT-green)
![](https://img.shields.io/github/package-json/dependency-version/asadahimeka/yandere-masonry/dev/vite)
![](https://img.shields.io/github/package-json/dependency-version/asadahimeka/yandere-masonry/@himeka/booru)
![](https://img.shields.io/github/package-json/dependency-version/asadahimeka/yandere-masonry/vue)
![](https://img.shields.io/github/package-json/dependency-version/asadahimeka/yandere-masonry/vuetify)

Booru sites masonry browsing mode.

Booru 站点瀑布流浏览聚合 & 标签中文翻译。

更新日志见 [CHANGELOG.md](https://github.com/asadahimeka/booruwf-web/blob/main/CHANGELOG.md)

Build with [vite](https://vitejs.dev)

## Preview

Web 版本: [点击预览](https://booru.kanata.ml)

用户脚本版本: [点击安装](https://greasyfork.org/zh-CN/scripts/444885)

## Features

### 标签中文翻译

添加 Y 站与 K 站标签的中文翻译，翻译文件来自 yande-re-chinese-patch

欢迎 [PR](https://github.com/asadahimeka/yandere-masonry/blob/main/src/data/tags_cn.json) 补充或校正翻译

### 输出下载地址

可使用 `输出下载地址` 功能保存图片地址 TXT 后使用迅雷、IDM、wget 等批量下载，见 [FoXZilla/Pxer#8](https://github.com/FoXZilla/Pxer/issues/8)

### 顶部操作

- 打开侧栏
- 加载指定页数
- 加载收藏夹、人气、随机作品（Y 站/K 站）
- 加载图集（Pool）列表
- 按标签搜索作品
- 瀑布流显示列数切换，列数选择非自动且列数小于 6 时图片会以 sample_url (即点击详情的大小) 展示。
- 批量选择
- 查看下载列表
- 深色模式切换
- 退出瀑布流模式

### 侧栏操作

- 站点切换，支持站点见下方所述
- 进入收藏夹、人气、随机作品页面（Y 站/K 站）
- 进入图集（Pool）页面（Y 站/K 站）
- 本地标签黑名单

### 详情查看

点击缩略图可查看详情，可进行以下操作

- 收藏（Y 站/K 站）
- 打开详情页面
- 打开来源地址
- 查看原图
- 下载/加入下载列表
- 打开标签页面
- 点击图片控制按钮与标签显示

### 站点支持

> ⚠ Notice
>
> 主要支持站点为 Yande.re 和 Konachan，其他站点为基本支持。
>
> 存在站点页面图片列表与 API 返回列表不一致的情况，请悉知。

https://danbooru.donmai.us/

https://konachan.com/

https://konachan.net/

https://yande.re/

https://gelbooru.com/

https://rule34.xxx/

https://lolibooru.moe/

https://www.sakugabooru.com/

https://safebooru.org/

https://tbib.org/

https://xbooru.com/

https://rule34.paheal.net/

https://realbooru.com/

## Screenshots

![](https://upload-bbs.mihoyo.com/upload/2022/08/13/260511332/a542077b61a2dcb85838baa41bf96c8c_7747043650649306795.png)

![](https://upload-bbs.mihoyo.com/upload/2022/08/13/260511332/14b7a0249234a79acac2d950db710b28_2747662949275143079.png)

![](https://upload-bbs.mihoyo.com/upload/2022/08/13/260511332/3886bf873b766f93e3cd103c0346705f_8954181707521812180.png)

![](https://upload-bbs.mihoyo.com/upload/2022/08/13/260511332/f18495ec74cf7895da6a583b6eef5815_2183319892513327746.png)

![](https://upload-bbs.mihoyo.com/upload/2022/08/13/260511332/59a35c4b527ec44904a6114a45033caf_7008024359546939405.png)

![](https://upload-bbs.mihoyo.com/upload/2022/08/13/260511332/c7c1ff0b187292ebc010fd40987ad52a_6882591913629167774.png)

![](https://upload-bbs.mihoyo.com/upload/2022/08/13/260511332/c0e70eea28e684bdb35e7ee77123235a_5045513856955976275.png)

![](https://upload-bbs.mihoyo.com/upload/2022/08/13/260511332/1fbb7f92ecba4a515b3a6781bd38610a_8247048012698921815.png)

![](https://upload-bbs.mihoyo.com/upload/2022/05/25/260511332/7eec96d7c629bc30ff4b1942838d9ea2_7197279808091047211.png)

![](https://upload-bbs.mihoyo.com/upload/2022/05/25/260511332/8dccc28bf99106aaab984feb383d4c1f_939382269553345713.png)

## Developing

```bash
git clone https://github.com/asadahimeka/booruwf-web.git
cd booruwf-web
yarn install
yarn dev
```

### Vue 3 + TypeScript + Vite

This template should help get you started developing with Vue 3 and TypeScript in Vite. The template uses Vue 3 `<script setup>` SFCs, check out the [script setup docs](https://v3.vuejs.org/api/sfc-script-setup.html#sfc-script-setup) to learn more.

### Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Volar](https://marketplace.visualstudio.com/items?itemName=johnsoncodehk.volar)

### Type Support For `.vue` Imports in TS

Since TypeScript cannot handle type information for `.vue` imports, they are shimmed to be a generic Vue component type by default. In most cases this is fine if you don't really care about component prop types outside of templates. However, if you wish to get actual prop types in `.vue` imports (for example to get props validation when using manual `h(...)` calls), you can enable Volar's Take Over mode by following these steps:

1. Run `Extensions: Show Built-in Extensions` from VS Code's command palette, look for `TypeScript and JavaScript Language Features`, then right click and select `Disable (Workspace)`. By default, Take Over mode will enable itself if the default TypeScript extension is disabled.
2. Reload the VS Code window by running `Developer: Reload Window` from the command palette.

You can learn more about Take Over mode [here](https://github.com/johnsoncodehk/volar/discussions/471).

## License

Modified from [yandere-masonry](https://github.com/asadahimeka/yandere-masonry)

[Booru Search API Service](https://github.com/asadahimeka/booru-search-api) using [booru-search](https://github.com/asadahimeka/booru-search)

Licensed under the [MIT](https://github.com/asadahimeka/booruwf-web/blob/main/LICENSE) license

Copyright © 2022 Yumine Sakura
