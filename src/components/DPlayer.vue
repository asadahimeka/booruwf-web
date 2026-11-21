<script lang="ts">
import DPlayer from 'dplayer'
// dplayer@1.27 的 dist 里没有独立 CSS，样式已随 JS 注入

// web 版：DPlayer 本地打包（脚本版为 CDN 注入 + unsafeWindow）
export default {
  props: {
    options: {
      type: Object,
    },
  },
  data() {
    return {
      dp: null as any,
    }
  },
  async mounted() {
    await this.$nextTick()
    this.initPlayer()
  },
  beforeUnmount() {
    this.dp?.destroy()
    this.dp = null
  },
  methods: {
    initPlayer() {
      this.dp = new DPlayer({ ...this.options, container: this.$el } as any)
      const events = (this.dp as any).events
      Object.keys(events).forEach(item => {
        if (item === 'events') {
          return false
        } else {
          events[item].forEach((event: string) => {
            this.dp.on(event, () => this.$emit(event))
          })
        }
      })
    },
  },
  render(h) {
    return h('div', {
      class: 'dplayer',
    }, [])
  },
}
</script>
