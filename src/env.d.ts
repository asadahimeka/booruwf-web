/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/ban-types
  const component: DefineComponent<{}, {}, any>
  export default component
}

declare module 'vuetify/lib/framework' {
  import 'vuetify/types'
  import Vuetify from 'vuetify'
  export default Vuetify
}

declare module '@himeka/masonry-css' {
  import Vue from 'vue'
  export default {
    install(app: typeof Vue): void
  }
}

declare module '@himeka/masonry-true' {
  import Vue from 'vue'
  export default {
    install(app: typeof Vue): void
  }
}

declare module 'dplayer' {
  const DPlayer: any
  export default DPlayer
}

interface Window {
  __tagsCN?: Record<string, string>
  /** 空格键形态的标签翻译（all_tags_cn_space.min.json，danbooru / e-shuushuu 用） */
  __tagsCNSpace?: Record<string, string>
}

/** @himeka/booru 包自带的全局钩子：包内请求 URI 构建时经此函数包装（返回 undefined 时用原 URI） */
declare var BOORU_FETCH_PROXY: ((uri: string) => string | undefined | void) | undefined

interface FileSystemHandle {
  queryPermission(descriptor?: { mode: 'read' | 'readwrite' }): Promise<PermissionState>
  requestPermission(descriptor?: { mode: 'read' | 'readwrite' }): Promise<PermissionState>
}

interface FileSystemFileHandle {
  createWritable(options?: { keepExistingData?: boolean }): Promise<any>
}

interface Window {
  showDirectoryPicker(options?: {
    id?: string;
    startIn?: 'desktop' | 'documents' | 'downloads' | 'music' | 'pictures' | 'videos' | FileSystemHandle;
    mode?: 'read' | 'readwrite';
  }): Promise<FileSystemDirectoryHandle>
}
