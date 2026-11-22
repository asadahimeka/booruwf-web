<template>
  <v-navigation-drawer
    v-model="store.showSettings"
    class="nav_drawer settings_drawer"
    :width="400"
    app
    temporary
    right
  >
    <v-list-item>
      <v-list-item-content>
        <v-list-item-title class="title">{{ $t('UxxldE9xRwmQctrvba5Y8') }}</v-list-item-title>
        <v-list-item-subtitle>{{ $t('Uw9QwD1SaR2VjZEqDYRdb') }}</v-list-item-subtitle>
      </v-list-item-content>
      <v-list-item-icon @click="store.showSettings = false">
        <v-btn icon>
          <v-icon>{{ mdiClose }}</v-icon>
        </v-btn>
      </v-list-item-icon>
    </v-list-item>
    <v-divider />
    <v-list dense nav>
      <v-list-item class="hidden-lg-and-up">
        <v-list-item-content>
          <v-list-item-title>{{ $t('e4_fgvntwNlfxgJUc2dXK') }}</v-list-item-title>
        </v-list-item-content>
        <v-list-item-action>
          <v-menu transition="slide-y-transition" offset-y>
            <template #activator="{ on, attrs }">
              <v-btn small v-bind="attrs" class="sel_menu_btn" style="max-width: 100px;" v-on="on">
                {{ currentLanglabel }}
                <v-icon :size="16">{{ mdiChevronDown }}</v-icon>
              </v-btn>
            </template>
            <v-list dense>
              <v-list-item-group :value="settings.lang" color="primary">
                <v-list-item v-for="lang in langList" :key="lang.value" :value="lang.value" dense @click="selectLang(lang.value)">
                  <v-list-item-title>{{ lang.label }}</v-list-item-title>
                </v-list-item>
              </v-list-item-group>
            </v-list>
          </v-menu>
        </v-list-item-action>
      </v-list-item>
      <v-list-item class="mb-0">
        <v-list-item-content>
          <v-list-item-title>
            <div class="d-flex align-center">
              <span>{{ $t('_Efl8k8uYQj9iJmj3kwbd') }}</span>
              <v-tooltip bottom>
                <template #activator="{ on, attrs }">
                  <v-btn class="ml-2" icon v-bind="attrs" v-on="on" @click.stop="exportBlacklist"><v-icon :size="18">{{ mdiContentCopy }}</v-icon></v-btn>
                </template>
                <span>{{ $t('EVPG1YZDtykdz3htyf11u') }}</span>
              </v-tooltip>
              <v-tooltip bottom>
                <template #activator="{ on, attrs }">
                  <v-btn icon v-bind="attrs" v-on="on" @click.stop="importBlacklist"><v-icon :size="18">{{ mdiContentPaste }}</v-icon></v-btn>
                </template>
                <span>{{ $t('kCYFwKpwznYIKRmB1tCww') }}</span>
              </v-tooltip>
            </div>
          </v-list-item-title>
          <v-list-item-subtitle>{{ $t('jMod2JozzAnwHuD-3KuPb') }}</v-list-item-subtitle>
        </v-list-item-content>
      </v-list-item>
      <v-list-item class="pa-0">
        <v-list-item-content class="pt-0">
          <v-combobox
            v-model="settings.blacklist"
            :append-icon="null"
            :items="[]"
            class="blacklist_combobox ma-0 pa-0"
            hide-details
            hide-no-data
            multiple
            outlined
            dense
            chips
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
      <template v-if="isBoorus">
        <v-list-item class="mb-0">
          <v-list-item-content>
            <v-list-item-title>{{ $t('RstKmO7YVQMpaDoucxUel') }}（{{ siteContext.host }}）</v-list-item-title>
            <v-list-item-subtitle>{{ $t('1F-R4qChHIzZaohu5GJzl') }}</v-list-item-subtitle>
          </v-list-item-content>
        </v-list-item>
        <v-list-item class="pa-0">
          <v-list-item-content class="pt-0">
            <v-text-field
              :value="settings.credentialQueries[siteContext.host] ?? ''"
              class="blacklist_combobox ma-0 pa-0"
              hide-details
              outlined
              dense
              :placeholder="credentialPlaceholder"
              @input="setCredentialQuery($event)"
            />
          </v-list-item-content>
        </v-list-item>
      </template>
      <template v-if="isSzuru">
        <v-list-item class="mb-0">
          <v-list-item-content>
            <v-list-item-title>{{ $t('szurubooruDomainTitle') }}</v-list-item-title>
            <v-list-item-subtitle>{{ $t('szurubooruDomainSubtitle') }}</v-list-item-subtitle>
          </v-list-item-content>
        </v-list-item>
        <v-list-item class="mb-0">
          <v-list-item-content>
            <v-list-item-title>{{ $t('szurubooruAuthTitle') }}</v-list-item-title>
            <v-list-item-subtitle>{{ $t('szurubooruAuthSubtitle') }}</v-list-item-subtitle>
          </v-list-item-content>
        </v-list-item>
        <v-list-item v-for="(cfg, i) in settings.szurubooruConfigs" :key="i" class="pa-0">
          <v-list-item-content class="pt-0">
            <div class="d-flex align-center">
              <v-text-field
                v-model="cfg.domain"
                :label="$t('szurubooruDomainLabel')"
                class="blacklist_combobox ma-0 pa-0 mr-1"
                hide-details
                outlined
                dense
              />
              <v-btn icon @click="removeSzuruConfig(i)">
                <v-icon :size="18">{{ mdiDelete }}</v-icon>
              </v-btn>
            </div>
            <div class="d-flex mt-1">
              <v-text-field
                v-model="cfg.username"
                :label="$t('szurubooruUsernameLabel')"
                class="blacklist_combobox ma-0 pa-0 mr-1"
                hide-details
                outlined
                dense
              />
              <v-text-field
                v-model="cfg.token"
                :label="$t('szurubooruTokenLabel')"
                :append-icon="showSzuruToken ? mdiEye : mdiEyeOff"
                :type="showSzuruToken ? 'text' : 'password'"
                class="blacklist_combobox ma-0 pa-0"
                hide-details
                outlined
                dense
                @click:append="showSzuruToken = !showSzuruToken"
              />
            </div>
          </v-list-item-content>
        </v-list-item>
        <v-list-item class="pa-0">
          <v-list-item-content class="pt-0">
            <v-btn small class="sel_menu_btn" @click="addSzuruConfig">
              <v-icon left :size="16">{{ mdiPlus }}</v-icon>
              {{ $t('szurubooruAddConfig') }}
            </v-btn>
          </v-list-item-content>
        </v-list-item>
      </template>
      <v-list-item v-if="notPartialSupportSite">
        <v-list-item-content>
          <v-list-item-title>{{ $t('Lm_HFVHpv4XCjilV3NLKu') }}</v-list-item-title>
          <v-list-item-subtitle>{{ $t('A16qoBulYQJLbHe9mqNwm') }}</v-list-item-subtitle>
        </v-list-item-content>
        <v-list-item-action>
          <v-switch
            v-model="nsfwSwitchValue"
            inset
            color="deep-orange darken-1"
            :loading="nsfwLoading"
            @change="onNSFWSwitchChange"
          />
        </v-list-item-action>
      </v-list-item>
      <v-list-item v-if="!settings.useFancybox">
        <v-list-item-content>
          <v-list-item-title>{{ $t('_nQfaNuwbvPAIFKOY6_7u') }}</v-list-item-title>
          <v-list-item-subtitle>{{ $t('SIUUZ4wqJTOilEdcX3EOi') }}</v-list-item-subtitle>
        </v-list-item-content>
        <v-list-item-action>
          <v-switch v-model="settings.isListenWheelEvent" inset />
        </v-list-item-action>
      </v-list-item>
      <v-list-item v-if="!settings.useFancybox">
        <v-list-item-content>
          <v-list-item-title>{{ $t('fVE5taO6GDTPbILat4GCt') }}</v-list-item-title>
          <v-list-item-subtitle>{{ $t('w95XGurDhDfOfw7XH4JFW') }}</v-list-item-subtitle>
        </v-list-item-content>
        <v-list-item-action>
          <v-switch v-model="settings.isListenKeyupEvent" inset />
        </v-list-item-action>
      </v-list-item>
      <v-list-item v-if="notPartialSupportSite && !settings.useFancybox">
        <v-list-item-content>
          <v-list-item-title>{{ $t('kFcteLMfnoezhOwuTlLFC') }}</v-list-item-title>
          <v-list-item-subtitle>{{ $t('FT1uJs8XG__n5qBvuFsH4') }}</v-list-item-subtitle>
        </v-list-item-content>
        <v-list-item-action>
          <v-switch v-model="settings.isFullImgPreload" inset />
        </v-list-item-action>
      </v-list-item>
      <v-list-item v-if="notPartialSupportSite && settings.isFullImgPreload">
        <v-list-item-content>
          <v-list-item-title>{{ $t('G3b7rbyQEj3_rgzVsNJZY') }}</v-list-item-title>
          <v-list-item-subtitle>{{ $t('iRt9V9wNQASic3D7-wTZo') }}</v-list-item-subtitle>
        </v-list-item-content>
        <v-list-item-action class="pl-1">
          <input
            :value="settings.imgPreloadNum"
            class="text-center rounded preload_num"
            type="number"
            min="0"
            max="5"
            @blur="onPreloadNumBlur"
          >
        </v-list-item-action>
      </v-list-item>
      <v-list-item>
        <v-list-item-content>
          <v-list-item-title>{{ $t('kop_-39vkeg-bz2wztJ9O') }}</v-list-item-title>
          <v-list-item-subtitle title="Masonry/Grid/Justified/Virtual">Masonry/Grid/Justified/Virtual</v-list-item-subtitle>
        </v-list-item-content>
        <v-list-item-action>
          <v-menu transition="slide-y-transition" offset-y>
            <template #activator="{ on, attrs }">
              <v-btn small v-bind="attrs" class="sel_menu_btn" style="max-width: 100px;" v-on="on">
                {{ actLayout }}
                <v-icon :size="16">{{ mdiChevronDown }}</v-icon>
              </v-btn>
            </template>
            <v-list dense>
              <v-list-item-group :value="actLayoutIndex" color="primary">
                <v-list-item v-for="item in layoutTypes" :key="item[0]" dense @click="onMasonryLayoutChange(item[0])">
                  <v-list-item-title v-text="item[1]" />
                </v-list-item>
              </v-list-item-group>
            </v-list>
          </v-menu>
        </v-list-item-action>
      </v-list-item>
      <v-list-item v-if="['masonry', 'grid', 'virtual'].includes(settings.masonryLayout)">
        <v-list-item-content>
          <v-list-item-title>{{ $t('tt_YdgKCA_5m-aSTSMPQ_') }}</v-list-item-title>
          <v-list-item-subtitle>{{ $t('rXjhc8VuGloy1wZ09noNB') }}</v-list-item-subtitle>
        </v-list-item-content>
        <v-list-item-action>
          <v-menu transition="slide-y-transition" offset-y>
            <template #activator="{ on, attrs }">
              <v-btn small v-bind="attrs" class="sel_menu_btn" v-on="on">
                <span style="margin-bottom:2px">{{ settings.selectedColumn === '0' ? $t('uxIs3XkeVzkrEX985zHk3') : settings.selectedColumn + $t('dU7ou5kVM0s9DMju5e2tS') }}</span>
                <v-icon :size="16">{{ mdiChevronDown }}</v-icon>
              </v-btn>
            </template>
            <v-list dense>
              <v-list-item-group :value="actCol" color="primary">
                <v-list-item v-for="col in cols" :key="col[0]" dense @click="settings.selectedColumn = col[0]">
                  <v-list-item-title v-text="col[1]" />
                </v-list-item>
              </v-list-item-group>
            </v-list>
          </v-menu>
        </v-list-item-action>
      </v-list-item>
      <v-list-item v-if="settings.masonryLayout === 'justified'">
        <v-list-item-content>
          <v-list-item-title>{{ $t('dm7zGAYbP2sbGXO_ekDDl') }}</v-list-item-title>
        </v-list-item-content>
        <v-list-item-action>
          <v-slider v-model="settings.justifiedBaseWidth" min="100" max="1200" step="1" thumb-label style="min-width: 200px;" />
        </v-list-item-action>
      </v-list-item>
      <v-list-item>
        <v-list-item-content>
          <v-list-item-title>{{ $t('4yzHPggVky2QKFD2TbBhl') }}</v-list-item-title>
          <v-list-item-subtitle>{{ $t('HSx0XMZFid_lVuwjzrhH0') }}</v-list-item-subtitle>
        </v-list-item-content>
        <v-list-item-action>
          <v-switch v-model="settings.isThumbSampleUrl" inset />
        </v-list-item-action>
      </v-list-item>
      <v-list-item v-if="showDownloadSourceSetting">
        <v-list-item-content>
          <v-list-item-title>{{ $t('downloadDefaultSizeTitle') }}</v-list-item-title>
          <v-list-item-subtitle>{{ $t('downloadDefaultSizeSubtitle') }}</v-list-item-subtitle>
        </v-list-item-content>
        <v-list-item-action>
          <v-menu transition="slide-y-transition" offset-y>
            <template #activator="{ on, attrs }">
              <v-btn small v-bind="attrs" class="sel_menu_btn" v-on="on">
                {{ actDownloadSourceText }}
                <v-icon :size="16">{{ mdiChevronDown }}</v-icon>
              </v-btn>
            </template>
            <v-list dense>
              <v-list-item-group :value="activeDownloadUrlKey" color="primary">
                <v-list-item v-for="it in downloadSourceOptions" :key="it.value" :value="it.value" dense @click="settings.downloadUrlKey = it.value">
                  <v-list-item-title>{{ it.text }}</v-list-item-title>
                </v-list-item>
              </v-list-item-group>
            </v-list>
          </v-menu>
        </v-list-item-action>
      </v-list-item>
      <v-list-item v-if="notPartialSupportSite">
        <v-list-item-content>
          <v-list-item-title>{{ $t('Ah2uP1cGRBQ6jff-SIc-Q') }}</v-list-item-title>
          <v-list-item-subtitle>{{ $t('rcpw-hgymDP2bsJPPUb_F') }}</v-list-item-subtitle>
        </v-list-item-content>
        <v-list-item-action>
          <v-menu transition="slide-y-transition" offset-y>
            <template #activator="{ on, attrs }">
              <v-btn small v-bind="attrs" class="sel_menu_btn" v-on="on">
                {{ actDownloadMethod }}
                <v-icon :size="16">{{ mdiChevronDown }}</v-icon>
              </v-btn>
            </template>
            <v-list dense>
              <v-list-item-group :value="settings.downloadBy" color="primary">
                <v-list-item v-for="it in downloadMethods" :key="it.value" :value="it.value" dense @click="settings.downloadBy = it.value">
                  <v-list-item-title>{{ it.text }}</v-list-item-title>
                </v-list-item>
              </v-list-item-group>
            </v-list>
          </v-menu>
        </v-list-item-action>
      </v-list-item>
      <v-list-item v-if="notPartialSupportSite && isFsaSupported && settings.downloadBy === 'fsa'">
        <v-list-item-content>
          <v-list-item-title>{{ $t('1sUsdpwBzU4gBf7Mrcihq') }}</v-list-item-title>
          <v-list-item-subtitle>{{ $t('jx2FWrN3O_8T7U5aSbvXj') }}</v-list-item-subtitle>
        </v-list-item-content>
        <v-list-item-action>
          <v-btn small class="sel_menu_btn" @click="setFsaDirName">{{ fsaDirName || $t('UOaS5wud2xGLzx9NGJxYQ') }}</v-btn>
        </v-list-item-action>
      </v-list-item>
      <!-- web 版特有：图片代理通道（ gelbooru 等站图源有防盗链，默认走同源 /img 网关） -->
      <v-list-item>
        <v-list-item-content>
          <v-list-item-title>{{ $t('imgProxyTitle') }}</v-list-item-title>
          <v-list-item-subtitle>{{ $t('imgProxySubtitle') }}</v-list-item-subtitle>
        </v-list-item-content>
        <v-list-item-action>
          <v-menu transition="slide-y-transition" offset-y>
            <template #activator="{ on, attrs }">
              <v-btn small v-bind="attrs" class="sel_menu_btn" v-on="on">
                {{ imgProxyLabel }}
                <v-icon :size="16">{{ mdiChevronDown }}</v-icon>
              </v-btn>
            </template>
            <v-list dense>
              <v-list-item-group :value="settings.imgProxy" color="primary">
                <v-list-item v-for="it in imgProxyOptions" :key="it.value" :value="it.value" dense @click="settings.imgProxy = it.value">
                  <v-list-item-title>{{ it.text }}</v-list-item-title>
                </v-list-item>
              </v-list-item-group>
            </v-list>
          </v-menu>
        </v-list-item-action>
      </v-list-item>
      <!-- web 版特有：API 代理通道（默认同源 /proxy；第三方前缀代理做不了伪装与挑战应答） -->
      <v-list-item>
        <v-list-item-content>
          <v-list-item-title>{{ $t('apiProxyTitle') }}</v-list-item-title>
          <v-list-item-subtitle>{{ $t('apiProxySubtitle') }}</v-list-item-subtitle>
        </v-list-item-content>
        <v-list-item-action>
          <v-menu transition="slide-y-transition" offset-y>
            <template #activator="{ on, attrs }">
              <v-btn small v-bind="attrs" class="sel_menu_btn" v-on="on">
                {{ apiProxyLabel }}
                <v-icon :size="16">{{ mdiChevronDown }}</v-icon>
              </v-btn>
            </template>
            <v-list dense>
              <v-list-item-group :value="settings.apiProxy" color="primary">
                <v-list-item v-for="it in apiProxyOptions" :key="it.value" :value="it.value" dense @click="settings.apiProxy = it.value">
                  <v-list-item-title>{{ it.text }}</v-list-item-title>
                </v-list-item>
              </v-list-item-group>
            </v-list>
          </v-menu>
        </v-list-item-action>
      </v-list-item>
      <v-list-item v-if="notPartialSupportSite && settings.downloadBy !== 'newtab'">
        <v-list-item-content>
          <v-list-item-title>{{ $t('PBjdNKuj02doUvOf2zZqP') }}</v-list-item-title>
          <v-list-item-subtitle v-if="settings.downloadBy === 'fsa'">{{ $t('dlSubpathSubtitle') }}</v-list-item-subtitle>
        </v-list-item-content>
        <v-list-item-action>
          <v-switch v-model="settings.isDLSubpath" inset :loading="dlSubLoading" @change="onDLSubpathChange" />
        </v-list-item-action>
      </v-list-item>
      <v-list-item>
        <v-list-item-content>
          <v-list-item-title>{{ $t('fbIpwMw2yVoSxP66OJ32z') }}</v-list-item-title>
          <v-list-item-subtitle>{{ $t('tEvQYzSVnggYAcM1uv9Tt') }}</v-list-item-subtitle>
        </v-list-item-content>
        <v-list-item-action>
          <v-switch v-model="settings.isFitScreen" inset />
        </v-list-item-action>
      </v-list-item>
      <v-list-item>
        <v-list-item-content>
          <v-list-item-title>{{ $t('lkCkz1OpNtTCFRfGCEoBp') }}</v-list-item-title>
          <v-list-item-subtitle>{{ $t('EZd1QQdgUDjT3yya5ZYe-') }}</v-list-item-subtitle>
        </v-list-item-content>
        <v-list-item-action>
          <v-switch v-model="settings.autoWaterfall" inset />
        </v-list-item-action>
      </v-list-item>
      <v-list-item>
        <v-list-item-content>
          <v-list-item-title>{{ $t('autoHideAppBarTitle') }}</v-list-item-title>
          <v-list-item-subtitle>{{ $t('autoHideAppBarSubtitle') }}</v-list-item-subtitle>
        </v-list-item-content>
        <v-list-item-action>
          <v-switch v-model="settings.autoHideAppBar" inset />
        </v-list-item-action>
      </v-list-item>
      <v-list-item v-if="notPartialSupportSite">
        <v-list-item-content>
          <v-list-item-title>{{ $t('sxhTRqogDRozo9IaTGI7g') }}</v-list-item-title>
          <v-list-item-subtitle>{{ $t('gPt6cpWrkvqRqZnwJo1KV') }}</v-list-item-subtitle>
        </v-list-item-content>
        <v-list-item-action>
          <v-switch v-model="settings.showPostCheckbox" inset />
        </v-list-item-action>
      </v-list-item>
      <v-list-item>
        <v-list-item-content>
          <v-list-item-title>{{ $t('UqbfVZzRyk0iD2NcOii_E') }}</v-list-item-title>
          <v-list-item-subtitle>{{ $t('_4E2zv2NpOG4y8TV5PRL0') }}</v-list-item-subtitle>
        </v-list-item-content>
        <v-list-item-action>
          <v-switch v-model="settings.showListPostReso" inset />
        </v-list-item-action>
      </v-list-item>
      <v-list-item>
        <v-list-item-content>
          <v-list-item-title>{{ $t('inlineHoverPlayTitle') }}</v-list-item-title>
          <v-list-item-subtitle>{{ $t('inlineHoverPlaySubtitle') }}</v-list-item-subtitle>
        </v-list-item-content>
        <v-list-item-action>
          <v-switch v-model="settings.inlineHoverPlay" inset />
        </v-list-item-action>
      </v-list-item>
      <v-list-item v-if="!settings.useFancybox">
        <v-list-item-content>
          <v-list-item-title>{{ $t('ECpLfRMsS0zpJPTw0qqNs') }}</v-list-item-title>
          <v-list-item-subtitle>{{ $t('vJobIibroyz2wkpmONSnR') }}</v-list-item-subtitle>
        </v-list-item-content>
        <v-list-item-action>
          <v-switch v-model="settings.detailButtonsBottom" inset />
        </v-list-item-action>
      </v-list-item>
      <v-list-item v-if="!settings.useFancybox">
        <v-list-item-content>
          <v-list-item-title>{{ $t('HPukB-OKzIuRxMmO4Rx2U') }}</v-list-item-title>
          <v-list-item-subtitle>{{ $t('I_MKXUxaNXp3D35GFULn4') }}</v-list-item-subtitle>
        </v-list-item-content>
        <v-list-item-action>
          <v-switch v-model="settings.closePopupOnImgClick" inset />
        </v-list-item-action>
      </v-list-item>
      <v-list-item v-if="isBoorus">
        <v-list-item-content>
          <v-list-item-title>{{ $t('dvs63FvVKWm3uHVfqeq00') }}</v-list-item-title>
          <v-list-item-subtitle>{{ $t('w4uJjpTmSEkm6SIDgEo-0') }}</v-list-item-subtitle>
        </v-list-item-content>
        <v-list-item-action>
          <v-switch v-model="settings.useFancybox" inset />
        </v-list-item-action>
      </v-list-item>
      <v-list-item v-if="store.isYKSite">
        <v-list-item-content>
          <v-list-item-title>{{ $t('IxTawC_qs_xjxj5g8_aGx') }}</v-list-item-title>
          <v-list-item-subtitle>{{ $t('-x4wjDoHtodaXEgm2SXkg') }}</v-list-item-subtitle>
        </v-list-item-content>
        <v-list-item-action>
          <v-switch v-model="settings.isHoldsFalse" inset :disabled="settings.isYandereFetchByHtml" />
        </v-list-item-action>
      </v-list-item>
      <v-list-item v-if="isYandere">
        <v-list-item-content>
          <v-list-item-title>{{ $t('YAUNSVT_pTygaY306DZmU') }}</v-list-item-title>
          <v-list-item-subtitle>{{ $t('HkRzE7fweBSefchs0z0r8') }}</v-list-item-subtitle>
        </v-list-item-content>
        <v-list-item-action>
          <v-switch v-model="settings.isYandereFetchByHtml" inset :disabled="settings.isHoldsFalse" />
        </v-list-item-action>
      </v-list-item>
    </v-list>
    <v-dialog v-model="showDLConfirm" max-width="600">
      <v-card>
        <v-card-title class="text-h5">{{ $t('ti3akdSS3iZV9NsGzIo3m') }}</v-card-title>
        <v-card-text>
          {{ $t('LN_Rsic4V50DrXbsv9T9L') }}<br>
          {{ $t('OJ8X55GXx5k3peoSXSujf') }}<br>
          {{ $t('ujBgilCWNgFNV8Q2IDMWS') }}
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn text @click="setDLSubpathOn(false)">{{ $t('9dq_DxgMG88eom9Gq-4nT') }}</v-btn>
          <v-btn color="primary" text @click="setDLSubpathOn(true)">{{ $t('0VAN4cJ-_mUxvtmg4KEi1') }}</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
    <!-- NSFW 18+ 确认框（web 版旧 NavDrawer 的交互）：开启前强制确认年龄合规 -->
    <v-dialog v-model="showNsfwConfirm" max-width="300" persistent>
      <v-card>
        <v-card-title class="text-h5">{{ $t('ti3akdSS3iZV9NsGzIo3m') }}</v-card-title>
        <v-card-text>{{ $t('nsfwConfirmText') }}</v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn color="primary" text @click="setNsfwShow(false)">{{ $t('9dq_DxgMG88eom9Gq-4nT') }}</v-btn>
          <v-btn text @click="setNsfwShow(true)">{{ $t('0VAN4cJ-_mUxvtmg4KEi1') }}</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-navigation-drawer>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useWindowSize } from '@vueuse/core'
import { mdiChevronDown, mdiClose, mdiContentCopy, mdiContentPaste, mdiDelete, mdiEye, mdiEyeOff, mdiPlus } from '@mdi/js'
import { SERVER_API_PROXY, SERVER_IMG_PROXY, apiProxys, imgProxys, settings, store } from '@/store'
import { langList } from '@/store/settings'
import { isBooruSite, isSampleDownloadSupportedSite, notPartialSupportSite } from '@/api/booru'
import { isSzurubooru } from '@/api/szurubooru'
import { showMsg } from '@/utils'
import i18n from '@/utils/i18n'
import { type DownloadUrlKey, getActiveDownloadUrlKey, getAvailableDownloadUrlKeys } from '@/utils/download-source'
import { getMainDirHandle, isFsaSupported, setMainDirHandle } from '@/utils/fsa'
import { siteContext } from '@/site-context'
import { useBackClose } from '@/utils/overlay-history'

const isBoorus = ref(isBooruSite())
const isYandere = ref(siteContext.host == 'yande.re')
const isSzuru = computed(() => isSzurubooru())
const showSzuruToken = ref(false)

// API 凭证按站点分槽：输入框只读写当前站（siteContext.host）的条目。
// 输入不合法（非 '&k=v' / '?k=v' 形态）时清空该站条目，避免垃圾值拼进上游 URL。
const credentialPlaceholder = i18n.t('1F-R4qChHIzZaohu5GJzl') as string
function setCredentialQuery(val: string) {
  const q = (val || '').trim()
  if (/^[?&][^&=]+=[^&]*/.test(q)) {
    settings.credentialQueries = { ...settings.credentialQueries, [siteContext.host]: q }
  } else if (!q) {
    const next = { ...settings.credentialQueries }
    delete next[siteContext.host]
    settings.credentialQueries = next
  }
}

function addSzuruConfig() {
  settings.szurubooruConfigs.push({ domain: '', username: '', token: '' })
}

function removeSzuruConfig(index: number) {
  settings.szurubooruConfigs.splice(index, 1)
}

const currentLanglabel = computed(() => langList.find(e => e.value === settings.lang)?.label)
function selectLang(val: typeof settings.lang) {
  settings.lang = val
  i18n.locale = val
}

function removeTagFromBlacklist(item: string) {
  settings.blacklist = settings.blacklist.filter(e => e != item)
}

function exportBlacklist() {
  navigator
    .clipboard
    .writeText(settings.blacklist.join(','))
    .then(() => showMsg({ msg: i18n.t('99kLMSzDYJCAf1yK9QYzy') as string }))
    .catch(() => showMsg({ msg: i18n.t('si-zDDRFrEwDTCkp53Q44') as string, type: 'error' }))
}

function importBlacklist() {
  navigator
    .clipboard
    .readText()
    .then(text => {
      if (text) {
        settings.blacklist = [...new Set([
          ...settings.blacklist,
          ...text.split(',').filter(Boolean),
        ])]
      }
    })
    .catch(() => showMsg({ msg: i18n.t('si-zDDRFrEwDTCkp53Q44') as string, type: 'error' }))
}

const hasSampleDownload = isSampleDownloadSupportedSite()
const downloadSourceOptions = computed(() => {
  const options: { text: string; value: DownloadUrlKey }[] = []
  if (hasSampleDownload) options.push({ text: i18n.t('wI4KHHIe3zNRziW4lDZrp').toString(), value: 'sampleUrl' })
  if (store.isYKSite) options.push({ text: i18n.t('k4YzDnBtd_S2UpAQucGxF').toString(), value: 'jpegUrl' })
  options.push({ text: i18n.t('VpuyxZtIoDF9-YyOm0tK_').toString(), value: 'fileUrl' })
  return options
})
const showDownloadSourceSetting = computed(() => notPartialSupportSite && downloadSourceOptions.value.length > 1)
const activeDownloadUrlKey = computed(() => {
  const keys = getAvailableDownloadUrlKeys(hasSampleDownload, store.isYKSite)
  return getActiveDownloadUrlKey(keys, settings.downloadUrlKey)
})
const actDownloadSourceText = computed(() => {
  return downloadSourceOptions.value.find(e => e.value === activeDownloadUrlKey.value)?.text || i18n.t('VpuyxZtIoDF9-YyOm0tK_').toString()
})

const downloadMethods = ref([
  // web 版：砍掉 Tampermonkey 通道，新增服务端 /dl 代理下载
  { text: i18n.t('downloadMethodServer'), value: 'server' } as const,
  { text: 'FileSystemAccess', value: 'fsa' } as const,
  { text: i18n.t('EsiorRgoeHI8h7IHMLDA4'), value: 'newtab' } as const,
])
const actDownloadMethod = computed(() => {
  return downloadMethods.value.find(e => e.value === settings.downloadBy)?.text
})

// 内置两项的文案走 i18n（store 里保持语言无关的值，避免模块加载期就固定语言）
const imgProxyOptions = computed(() => imgProxys.map(e => ({
  ...e,
  text: e.value === ''
    ? i18n.t('imgProxyOff').toString()
    : e.value === SERVER_IMG_PROXY ? i18n.t('imgProxyDefault').toString() : e.text,
})))
const imgProxyLabel = computed(() => {
  return imgProxyOptions.value.find(e => e.value === settings.imgProxy)?.text
})

const apiProxyOptions = computed(() => apiProxys.map(e => ({
  text: e.value === SERVER_API_PROXY ? i18n.t('imgProxyDefault').toString() : e.text,
  value: e.value,
})))
const apiProxyLabel = computed(() => {
  return apiProxyOptions.value.find(e => e.value === settings.apiProxy)?.text
})

const fsaDirName = ref('')
getFsaDirName()
async function getFsaDirName() {
  if (!isFsaSupported) {
    downloadMethods.value = downloadMethods.value.filter(e => e.value !== 'fsa')
    return
  }
  const dirHandle = await getMainDirHandle()
  if (dirHandle) {
    fsaDirName.value = dirHandle.name
  }
}
async function setFsaDirName() {
  try {
    const dirHandle = await setMainDirHandle()
    fsaDirName.value = dirHandle.name
  } catch (err) {
    console.log('setFsaDirName err: ', err)
  }
}

const dlSubLoading = ref(false)
const showDLConfirm = ref(false)
function setDLSubpathOn(val: boolean) {
  settings.isDLSubpath = val
  showDLConfirm.value = false
  dlSubLoading.value = false
}
function onDLSubpathChange(val: boolean) {
  if (settings.downloadBy != 'fsa') return
  dlSubLoading.value = true
  if (val) {
    showDLConfirm.value = true
  } else {
    setDLSubpathOn(false)
  }
}

/**
 * NSFW 开关（web 版旧 NavDrawer 交互）：
 * - 开启：先弹 18+ 确认框，取消不动，确认后生效并回到当前站点首页
 *   （旧版 returnToIndex：已加载的列表里可能混有 NSFW 帖子，必须重拉）
 * - 关闭：立即生效并回到当前站点首页
 */
const showNsfwConfirm = ref(false)
// v-model 镜像（与 isDLSubpath 开关同模式）：v-switch 的内部状态必须经
// v-model 同步，用 :value 绑定会失步（取消后开关内部仍是 true，下次 change 值错乱）
const nsfwSwitchValue = ref(settings.showNSFWContents)
const nsfwLoading = ref(false)

// 移动端返回键关闭（history 陷阱模式，见 overlay-history.ts）：
// 设置抽屉 / 下载子目录确认框 / NSFW 确认框，层级按注册顺序
useBackClose(
  () => store.showSettings,
  () => { store.showSettings = false },
)
useBackClose(
  () => showDLConfirm.value,
  () => setDLSubpathOn(false),
)
// persistent 确认框不能点遮罩关闭，返回键 = 取消：仅关掉弹窗并还原开关显示
useBackClose(
  () => showNsfwConfirm.value,
  () => {
    showNsfwConfirm.value = false
    nsfwLoading.value = false
    nsfwSwitchValue.value = settings.showNSFWContents
  },
)
function setNsfwShow(val: boolean) {
  settings.showNSFWContents = val
  nsfwSwitchValue.value = val
  showNsfwConfirm.value = false
  nsfwLoading.value = false
  // 必须在整页跳转前同步落盘：App.vue 的持久化 watcher 是异步 flush，
  // location.assign 会先卸载页面，异步写来不及发生（实测确认开启时设置丢失）
  localStorage.setItem('YM_APP_SETTINGS', JSON.stringify(settings))
  // 回到当前站点首页并重拉（旧版 returnToIndex）：已加载的列表可能混有
  // NSFW 帖子（开启时）或整页都是 rating 'e'（关闭时），原地 reload 会停在空列表
  location.assign(`/?site=${encodeURIComponent(siteContext.host)}`)
}
function onNSFWSwitchChange(val: boolean) {
  nsfwLoading.value = true
  if (val) {
    showNsfwConfirm.value = true
  } else {
    setNsfwShow(false)
  }
}

const { width: windowWidth } = useWindowSize()
const allColList = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 14, 16, 18, 20]
const colList = computed(() => settings.masonryLayout == 'virtual' ? allColList.filter(e => e < (windowWidth.value - 32) / 300) : allColList)
const cols = computed(() => colList.value.map(e => [`${e}`, e === 0 ? i18n.t('uxIs3XkeVzkrEX985zHk3').toString() : `${e} ${i18n.t('dU7ou5kVM0s9DMju5e2tS')}`]))
const actCol = computed(() => {
  return colList.value.findIndex(e => e.toString() === settings.selectedColumn)
})

const layoutTypes = ref([
  ['masonry', `Masonry/${i18n.t('6jPGehET9TViankl5-SRu')}`],
  ['grid', `Grid/${i18n.t('vfUg8xP6WptIhSL0E9b9D')}`],
  ['justified', `Justified/${i18n.t('LZbI8am7nD-LiemZzroFF')}`],
  ['virtual', `Virtual/${i18n.t('yYtssYrCL8VwFrdvvx8v3')}`],
  ['masonry2', `Masonry2/${i18n.t('6jPGehET9TViankl5-SRu')}`],
])
const actLayout = computed(() => {
  return layoutTypes.value.find(e => e[0] === settings.masonryLayout)?.[1]?.split('/')?.[0]
})
const actLayoutIndex = computed(() => {
  return layoutTypes.value.findIndex(e => e[0] === settings.masonryLayout)
})
function onMasonryLayoutChange(val: any) {
  settings.masonryLayout = val
  settings.selectedColumn = '0'
}

function onPreloadNumBlur(ev: Event) {
  const input = ev.target as HTMLInputElement
  if (input.validationMessage) {
    input.value = '1'
    settings.imgPreloadNum = 1
  } else {
    const num = Number(input.value) || 1
    settings.imgPreloadNum = num
  }
}
</script>
