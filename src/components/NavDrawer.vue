<template>
  <v-navigation-drawer v-model="store.showDrawer" class="nav_drawer" app temporary>
    <v-list-item>
      <v-list-item-avatar>
        <img width="40" src="/pwa-192x192.png" alt="" loading="lazy">
      </v-list-item-avatar>
      <v-list-item-content>
        <v-list-item-title class="title">Booru Masonry</v-list-item-title>
        <v-list-item-subtitle :title="$t('l8CbIALt_VWUnzBl_Rmgf')">{{ $t('l8CbIALt_VWUnzBl_Rmgf') }}</v-list-item-subtitle>
      </v-list-item-content>
    </v-list-item>
    <v-divider />
    <v-list v-if="store.isYKSite" dense nav>
      <v-list-group :value="true" no-action>
        <template #activator>
          <v-list-item-content>
            <v-list-item-title class="title">{{ $t('CacM8tispuPNrSxxpt9GX') }}</v-list-item-title>
          </v-list-item-content>
        </template>

        <v-list-item link href="/?site=yande.re&path=/pool">
          <v-list-item-icon class="mr-2">
            <v-icon>{{ mdiImageMultiple }}</v-icon>
          </v-list-item-icon>
          <v-list-item-content>
            <v-list-item-title>{{ $t('DXEhXAQbkiCMU_l252jo_') }}</v-list-item-title>
          </v-list-item-content>
        </v-list-item>
        <v-list-item link href="/?site=yande.re&path=/post/popular_recent">
          <v-list-item-icon class="mr-2">
            <v-icon>{{ mdiFire }}</v-icon>
          </v-list-item-icon>
          <v-list-item-content>
            <v-list-item-title>{{ $t('7Cgsr4PUMbezDXNfWdvWH') }}</v-list-item-title>
          </v-list-item-content>
        </v-list-item>
        <v-list-item link href="/?site=yande.re&tags=order%3Arandom&page=1">
          <v-list-item-icon class="mr-2">
            <v-icon>{{ mdiShuffle }}</v-icon>
          </v-list-item-icon>
          <v-list-item-content>
            <v-list-item-title>{{ $t('StU1-52QJmNFKQ5soJCyG') }}</v-list-item-title>
          </v-list-item-content>
        </v-list-item>
      </v-list-group>
    </v-list>
    <v-list dense nav>
      <v-list-group :value="true" no-action>
        <template #activator>
          <v-list-item-content>
            <v-list-item-title class="title">{{ $t('e2_EYvweJsVoIZlIWkPRV') }}</v-list-item-title>
          </v-list-item-content>
        </template>
        <v-list-item-group :value="actSiteIndex" color="primary">
          <v-list-item v-for="link in navSites" :key="link" :href="handleLink(link)" referrerpolicy="no-referrer">
            <v-list-item-icon class="mr-2">
              <div class="site_icon site_icon_fallback" :style="{ backgroundColor: fallbackColor(link) }">{{ fallbackLetter(link) }}</div>
            </v-list-item-icon>
            <v-list-item-content>
              <v-list-item-title>{{ getSiteTitle(link) }}</v-list-item-title>
            </v-list-item-content>
          </v-list-item>
          <hr class="my-2">
          <v-list-item v-for="tool in toolLinks" :key="tool.host" link @click="openLink(tool.url)">
            <v-list-item-icon class="mr-2">
              <div class="site_icon site_icon_fallback" :style="{ backgroundColor: fallbackColor(tool.host) }">{{ fallbackLetter(tool.host) }}</div>
            </v-list-item-icon>
            <v-list-item-content>
              <v-list-item-title>{{ tool.title }}</v-list-item-title>
            </v-list-item-content>
          </v-list-item>
        </v-list-item-group>
      </v-list-group>
    </v-list>
    <v-list dense nav>
      <v-list-item link @click="showSettingDrawer()">
        <v-list-item-content>
          <v-list-item-title class="title">{{ $t('UxxldE9xRwmQctrvba5Y8') }}</v-list-item-title>
        </v-list-item-content>
      </v-list-item>
    </v-list>
    <v-list dense nav>
      <v-list-group :value="true" no-action>
        <template #activator>
          <v-list-item-content>
            <v-list-item-title class="title">{{ $t('PT74UDfKA45vTVTst_-hD') }}</v-list-item-title>
          </v-list-item-content>
        </template>

        <v-list-item link @click="openLink('https://github.com/asadahimeka/yandere-masonry/blob/main/CHANGELOG.md')">
          <v-list-item-icon class="mr-2">
            <v-icon>{{ mdiInformationOutline }}</v-icon>
          </v-list-item-icon>
          <v-list-item-content>
            <v-list-item-title>v{{ version }}</v-list-item-title>
            <v-list-item-subtitle>{{ $t('iJ0h220tvMmUhkfIMYI-W') }}</v-list-item-subtitle>
          </v-list-item-content>
        </v-list-item>
        <v-list-item link @click="openLink('https://github.com/asadahimeka/booruwf-web/issues')">
          <v-list-item-icon class="mr-2">
            <v-icon>{{ mdiMessageAlertOutline }}</v-icon>
          </v-list-item-icon>
          <v-list-item-content>
            <v-list-item-title>{{ $t('23iEYyiQlLVhFIqGbj527') }}</v-list-item-title>
            <v-list-item-subtitle>{{ $t('4g1TUy2kwQrdOs-w4JobB') }}</v-list-item-subtitle>
          </v-list-item-content>
        </v-list-item>
        <v-list-item link @click="openLink('https://github.com/asadahimeka/booruwf-web')">
          <v-list-item-icon class="mr-2">
            <v-icon>{{ mdiGithub }}</v-icon>
          </v-list-item-icon>
          <v-list-item-content>
            <v-list-item-title>Github</v-list-item-title>
            <v-list-item-subtitle>{{ $t('7Xq5puLNcT0mAvoxElqdf') }}</v-list-item-subtitle>
          </v-list-item-content>
        </v-list-item>
        <!-- 脚本版（yandere-masonry）仓库：web 版的上游用户脚本实现 -->
        <v-list-item link @click="openLink('https://github.com/asadahimeka/yandere-masonry')">
          <v-list-item-icon class="mr-2">
            <v-icon>{{ mdiSourceRepository }}</v-icon>
          </v-list-item-icon>
          <v-list-item-content>
            <v-list-item-title>yandere-masonry</v-list-item-title>
            <v-list-item-subtitle>{{ $t('userscriptRepo') }}</v-list-item-subtitle>
          </v-list-item-content>
        </v-list-item>
      </v-list-group>
    </v-list>
  </v-navigation-drawer>
</template>

<script setup lang="ts">
import {
  mdiFire,
  mdiGithub,
  mdiImageMultiple,
  mdiInformationOutline,
  mdiMessageAlertOutline,
  mdiShuffle,
  mdiSourceRepository,
} from '@mdi/js'
import { computed, ref } from 'vue'
import pkg from '../../package.json'
import { getSiteTitle, siteDomains } from '@/api/booru'
import { getSiteDefaultPath, isNsfwOnlySite } from '@/api/sites'
import { SZURU_DEMO_HOST, normalizeSzuruDomain } from '@/api/szurubooru'
import { settings, store } from '@/store'
import { siteContext } from '@/site-context'
import { useBackClose } from '@/utils/overlay-history'

// 移动端返回键关闭抽屉（history 陷阱模式，见 overlay-history.ts）
useBackClose(
  () => store.showDrawer,
  () => { store.showDrawer = false },
)

// 站点导航 = 内置站点 + 已配置的自部署 szurubooru 域名；
// NSFW 关闭时隐藏「全站 NSFW」站点（列表恒空，见 sites.ts NSFW_ONLY_SITES）
const navSites = computed(() => {
  const szuruDomains = settings.szurubooruConfigs
    .map(c => normalizeSzuruDomain(c.domain))
    .filter(d => d && d !== SZURU_DEMO_HOST && !siteDomains.includes(d))
  const all = [...siteDomains, ...szuruDomains]
  return settings.showNSFWContents ? all : all.filter(e => !isNsfwOnlySite(e))
})

const version = ref(pkg.version)

function openLink(link: string) {
  window.open(link, '_blank', 'noreferrer')
}

/** web 版：站内切换 = 改 ?site= 参数走同一个 SPA */
function handleLink(link: string) {
  // 首页不是可接管列表的站点（nanairo 等）必须带默认入口路径，否则落进空瀑布流
  const path = getSiteDefaultPath(link)
  return path
    ? `/?site=${encodeURIComponent(link)}&path=${encodeURIComponent(path)}`
    : `/?site=${encodeURIComponent(link)}`
}

const FALLBACK_COLORS = ['#e91e63', '#8e24aa', '#3949ab', '#1e88e5', '#00897b', '#43a047', '#f4511e', '#5c6bc0']

const toolLinks = [
  { title: 'Pixiv Viewer', url: 'https://pixiv.pictures/?ref=booru.vercel.app', host: 'pixiv.pictures' },
  { title: 'Moeview', url: 'https://moeview.app/?ref=booru.vercel.app', host: 'moeview.app' },
  { title: 'R-34.XYZ', url: 'https://r-34.xyz/?ref=booru.vercel.app', host: 'r-34.xyz' },
  { title: 'Nekon', url: 'https://nekon.app/?ref=booru.vercel.app', host: 'nekon.app' },
  { title: 'SomeACG', url: 'https://www.someacg.top/?ref=booru.vercel.app', host: 'someacg.top' },
  { title: 'ManyACG', url: 'https://manyacg.top/?ref=booru.vercel.app', host: 'manyacg.top' },
  { title: 'Cosine Gallery', url: 'https://pic.cosine.ren/?ref=booru.vercel.app', host: 'pic.cosine.ren' },
]

function fallbackColor(url: string) {
  let hash = 0
  for (let i = 0; i < url.length; i++) hash = (hash * 31 + url.charCodeAt(i)) >>> 0
  return FALLBACK_COLORS[hash % FALLBACK_COLORS.length]
}

function fallbackLetter(url: string) {
  const host = url.replace(/^https?:\/\//, '').split('/')[0].replace(/^www\./, '')
  return host.charAt(0).toUpperCase() || '?'
}

const actSiteIndex = computed(() => {
  return navSites.value.findIndex(e => siteContext.host.includes(e) || e.includes(siteContext.host))
})

function showSettingDrawer() {
  store.showDrawer = false
  store.showSettings = true
}
</script>
