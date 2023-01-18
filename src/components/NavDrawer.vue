<template>
  <v-navigation-drawer v-model="store.showDrawer" class="nav_drawer" app temporary>
    <v-list-item>
      <v-list-item-content>
        <v-list-item-title class="title">booruwf</v-list-item-title>
        <v-list-item-subtitle>Booru 站点瀑布流布局浏览</v-list-item-subtitle>
      </v-list-item-content>
    </v-list-item>
    <v-divider />
    <v-list v-if="store.showNSFWContents && store.isYKSite" dense nav>
      <v-list-item>
        <v-list-item-content>
          <v-list-item-title class="title">快捷方式</v-list-item-title>
        </v-list-item-content>
      </v-list-item>
      <!-- <v-list-item v-if="userName" link href="/user/home">
        <v-list-item-icon class="mr-2">
          <v-icon>{{ mdiAccount }}</v-icon>
        </v-list-item-icon>
        <v-list-item-content>
          <v-list-item-title>{{ userName }}</v-list-item-title>
        </v-list-item-content>
      </v-list-item>
      <v-list-item v-if="userName" link :href="`/post?tags=vote%3A3%3A${userName}+order%3Avote&_wf=1`">
        <v-list-item-icon class="mr-2">
          <v-icon>{{ mdiStar }}</v-icon>
        </v-list-item-icon>
        <v-list-item-content>
          <v-list-item-title>我的收藏夹</v-list-item-title>
        </v-list-item-content>
      </v-list-item> -->
      <v-list-item link :href="`/?site=${host}&page=1&path=%2Fpool`">
        <v-list-item-icon class="mr-2">
          <v-icon>{{ mdiImageMultiple }}</v-icon>
        </v-list-item-icon>
        <v-list-item-content>
          <v-list-item-title>图集 (Pool)</v-list-item-title>
        </v-list-item-content>
      </v-list-item>
      <v-list-item link :href="`/?site=${host}&path=%2Fpost%2Fpopular_by_day&page=1`">
        <v-list-item-icon class="mr-2">
          <v-icon>{{ mdiFire }}</v-icon>
        </v-list-item-icon>
        <v-list-item-content>
          <v-list-item-title>人气作品</v-list-item-title>
        </v-list-item-content>
      </v-list-item>
      <v-list-item link :href="`/?site=${host}&page=1&tags=order%3Arandom`">
        <v-list-item-icon class="mr-2">
          <v-icon>{{ mdiShuffle }}</v-icon>
        </v-list-item-icon>
        <v-list-item-content>
          <v-list-item-title>随机作品</v-list-item-title>
        </v-list-item-content>
      </v-list-item>
    </v-list>
    <v-list dense nav>
      <v-list-item>
        <v-list-item-content>
          <v-list-item-title class="title">站点列表</v-list-item-title>
        </v-list-item-content>
      </v-list-item>
      <v-list-item v-for="link in siteLinks" :key="link" :href="dealLink(link)">
        <v-list-item-icon class="mr-2">
          <v-icon>{{ mdiArrowRightCircleOutline }}</v-icon>
        </v-list-item-icon>
        <v-list-item-content>
          <v-list-item-title>{{ link.toUpperCase() }}</v-list-item-title>
        </v-list-item-content>
      </v-list-item>
      <v-list-item link @click="openLink('https://www.nanoka.top/illust/pixiv/')">
        <v-list-item-icon class="mr-2">
          <v-icon>{{ mdiArrowRightCircleOutline }}</v-icon>
        </v-list-item-icon>
        <v-list-item-content>
          <v-list-item-title>Pixiv Ranking</v-list-item-title>
        </v-list-item-content>
      </v-list-item>
      <v-list-item link @click="openLink('https://pixiv.kanata.ml')">
        <v-list-item-icon class="mr-2">
          <v-icon>{{ mdiArrowRightCircleOutline }}</v-icon>
        </v-list-item-icon>
        <v-list-item-content>
          <v-list-item-title>Pixiv Viewer</v-list-item-title>
        </v-list-item-content>
      </v-list-item>
    </v-list>
    <v-list dense nav>
      <v-list-item>
        <v-list-item-content>
          <v-list-item-title class="title">设置</v-list-item-title>
        </v-list-item-content>
      </v-list-item>
      <!-- <v-list-item class="mb-0">
        <v-list-item-content>
          <v-list-item-title>图片代理</v-list-item-title>
          <v-list-item-subtitle>请选择图片代理</v-list-item-subtitle>
        </v-list-item-content>
      </v-list-item>
      <v-list-item class="pa-0">
        <v-list-item-content class="pt-0">
          <v-select
            v-model="store.imgProxy"
            :items="store.imgProxys"
            outlined
            dense
            hide-details
            @change="onImgProxyChange"
          />
        </v-list-item-content>
      </v-list-item> -->
      <v-list-item>
        <v-list-item-content>
          <v-list-item-title>NSFW 开关</v-list-item-title>
          <v-list-item-subtitle>包含裸露或性描写内容</v-list-item-subtitle>
        </v-list-item-content>
        <v-list-item-action>
          <v-switch
            v-model="switchValue"
            color="deep-orange darken-1"
            :loading="switchLoading"
            @change="onNSFWSwitchChange"
          />
        </v-list-item-action>
      </v-list-item>
      <v-list-item class="mb-0">
        <v-list-item-content>
          <v-list-item-title>标签黑名单</v-list-item-title>
          <v-list-item-subtitle>下方输入标签，回车添加</v-list-item-subtitle>
        </v-list-item-content>
      </v-list-item>
      <v-list-item class="pa-0">
        <v-list-item-content class="pt-0">
          <v-combobox
            v-model="store.blacklist"
            :append-icon="null"
            :items="[]"
            class="ma-0 pa-0"
            hide-details
            hide-no-data
            multiple
            outlined
            dense
            chips
            @change="onComboboxChange"
          >
            <template #selection="{ item }">
              <v-chip
                label
                small
                outlined
                close
                @click:close="removeTagFromBlacklist(item)"
              >
                <span>{{ item }}</span>
              </v-chip>
            </template>
          </v-combobox>
        </v-list-item-content>
      </v-list-item>
    </v-list>
    <v-list dense nav>
      <v-list-item>
        <v-list-item-content>
          <v-list-item-title class="title">关于</v-list-item-title>
        </v-list-item-content>
      </v-list-item>
      <v-list-item link @click="openLink('https://github.com/asadahimeka/booruwf-web/blob/main/CHANGELOG.md')">
        <v-list-item-icon class="mr-2">
          <v-icon>{{ mdiInformationOutline }}</v-icon>
        </v-list-item-icon>
        <v-list-item-content>
          <!-- <v-list-item-title>v{{ version }}</v-list-item-title>
          <v-list-item-subtitle>更新日志</v-list-item-subtitle> -->
          <v-list-item-title>更新日志</v-list-item-title>
          <v-list-item-subtitle>点击查看</v-list-item-subtitle>
        </v-list-item-content>
      </v-list-item>
      <v-list-item link @click="openLink('https://greasyfork.org/zh-CN/scripts/444885')">
        <v-list-item-icon class="mr-2">
          <v-icon>{{ mdiScriptTextPlayOutline }}</v-icon>
        </v-list-item-icon>
        <v-list-item-content>
          <v-list-item-title>用户脚本版</v-list-item-title>
          <v-list-item-subtitle>点击安装</v-list-item-subtitle>
        </v-list-item-content>
      </v-list-item>
      <v-list-item link @click="openLink('https://github.com/asadahimeka/booruwf-web/issues')">
        <v-list-item-icon class="mr-2">
          <v-icon>{{ mdiMessageAlertOutline }}</v-icon>
        </v-list-item-icon>
        <v-list-item-content>
          <v-list-item-title>问题与建议</v-list-item-title>
          <v-list-item-subtitle>点击反馈</v-list-item-subtitle>
        </v-list-item-content>
      </v-list-item>
      <v-list-item link @click="openLink('https://github.com/asadahimeka/booruwf-web')">
        <v-list-item-icon class="mr-2">
          <v-icon>{{ mdiGithub }}</v-icon>
        </v-list-item-icon>
        <v-list-item-content>
          <v-list-item-title>Github</v-list-item-title>
          <v-list-item-subtitle>欢迎 Star ☆彡</v-list-item-subtitle>
        </v-list-item-content>
      </v-list-item>
    </v-list>
    <v-dialog v-model="showDialog" max-width="300">
      <v-card>
        <v-card-title class="text-h5">提示</v-card-title>
        <v-card-text>
          确定要开启 NSFW/R-18 作品显示吗？请确保您的年龄已满18岁，且未违反当地法律法规所规定的内容。
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn color="primary" text @click="setNSFWShow('')">取消</v-btn>
          <v-btn text @click="setNSFWShow('1')">确定</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-navigation-drawer>
</template>

<script setup lang="ts">
import {
  // mdiAccount,
  mdiArrowRightCircleOutline,
  mdiFire,
  mdiGithub,
  mdiImageMultiple,
  mdiInformationOutline,
  mdiMessageAlertOutline,
  mdiScriptTextPlayOutline,
  mdiShuffle,
  // mdiStar,
} from '@mdi/js'
import { /* onMounted, */ computed, ref } from '@vue/composition-api'
import { getCurrSite, siteDomains } from '@/api/booru'
// import { getUsername } from '@/api/moebooru'
import store from '@/store'

const host = ref(getCurrSite())

const NSFWSitesMap: Record<string, boolean> = {
  'rule34.xxx': true,
  'tbib.org': true,
  'xbooru.com': true,
  'rule34.paheal.net': true,
  'realbooru.com': true,
}

const siteLinks = computed(() => {
  return store.showNSFWContents
    ? siteDomains
    : siteDomains.filter(e => !NSFWSitesMap[e])
})

// const userName = ref('')
// const version = ref(GM_info.script.version)

const showDialog = ref(false)
const switchValue = ref(store.showNSFWContents)
const switchLoading = ref(false)
const returnToIndex = () => {
  location.assign(`${location.origin}?site=${host.value}`)
}
const setNSFWShow = (val: string) => {
  store.showNSFWContents = !!val
  switchValue.value = !!val
  localStorage.setItem('__showNSFW', val)
  showDialog.value = false
  switchLoading.value = false
  val && returnToIndex()
}
const onNSFWSwitchChange = (val: any) => {
  switchLoading.value = true
  if (val) {
    showDialog.value = true
  } else {
    setNSFWShow('')
    returnToIndex()
  }
}

const openLink = (link: string) => {
  window.open(link, '_blank', 'noreferrer')
}

const dealLink = (link: string) => {
  const params = new URLSearchParams()
  if (link.includes('yande')) params.set('path', 'post')
  params.set('site', link.toLowerCase())
  return `/?${params}`
}

const onComboboxChange = (val: string[]) => {
  localStorage.setItem('__blacklist', val.join(','))
}

const removeTagFromBlacklist = (item: string) => {
  store.blacklist.splice(store.blacklist.indexOf(item), 1)
  localStorage.setItem('__blacklist', store.blacklist.join(','))
}

// const onImgProxyChange = (val: string) => {
//   localStorage.setItem('__imgProxy', val)
//   location.reload()
// }

// onMounted(async () => {
//   if (store.isYKSite) {
//     const name = await getUsername()
//     if (name) userName.value = name
//   }
// })
</script>
