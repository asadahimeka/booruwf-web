<script>
export default {
  props: {
    options: {
      type: Object,
    },
  },
  data() {
    return {
      dp: null,
    }
  },
  async mounted() {
    if (!window.DPlayer) {
      await new Promise(resolve => {
        const script = document.createElement('script')
        script.src = 'https://unpkg.com/dplayer@1.26.0/dist/DPlayer.min.js'
        script.addEventListener('load', resolve, false)
        document.head.appendChild(script)
      })
    }
    await this.$nextTick()
    this.initPlayer()
  },
  // eslint-disable-next-line vue/no-deprecated-destroyed-lifecycle
  beforeDestroy() {
    this.dp.destroy()
    this.dp = null
  },
  methods: {
    initPlayer() {
      this.dp = new window.DPlayer({ ...this.options, container: this.$el })
      const events = this.dp.events
      Object.keys(events).forEach(item => {
        if (item === 'events') {
          return false
        } else {
          events[item].forEach(event => {
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
