/**
 * 覆盖层（弹窗/抽屉）的历史栈管理：让移动端返回键关闭弹窗，而不是直接退出页面。
 *
 * 原理（history 陷阱模式）：
 * - 覆盖层打开时向历史栈压入一条哨兵记录（history.pushState，URL 不变）
 * - 返回键（popstate）弹掉哨兵时，关闭最上层打开的覆盖层
 * - 覆盖层以其它方式关闭（点 X / 点遮罩 / 程序关闭）时，反向 history.go(-n)
 *   弹掉对应数量的哨兵，保证历史栈与打开层数一致
 *
 * 所有哨兵增减都合并到同一轮微任务里做「账目同步」：同一 tick 内「关一个开一个」
 * （如导航抽屉切到设置抽屉）净变化为零，不做任何历史操作，规避 back() 是异步
 * 遍历、与紧随其后的 pushState 产生竞态的问题。
 *
 * 边界情况：
 * - AppBar 会在哨兵之上 push 真实 URL（history.pushState('', '', url)），此时
 *   当前条目不是哨兵，sync 主动放弃修正——宁可多留一条无害的哨兵，也不能误退
 *   真实历史；多留的哨兵被返回键弹掉时 openStack 为空，什么都不发生
 * - 刷新落在哨兵条目上：初始化时用 replaceState 清掉标记，该条历史恢复正常
 *   语义，再按一次返回正常离开页面
 */
import { watch } from 'vue'

interface OverlayBinding {
  close: () => void
}

/** 哨兵记录的 state 标记（AppBar 的 pushState 用 '' 作 state，不会冲突） */
const OVERLAY_FLAG = 'ymOverlaySentinel'

/** 账本：已压入历史栈的哨兵数量 */
let pushedCount = 0
/** 打开中的覆盖层栈，后打开的在栈顶 */
const openStack: OverlayBinding[] = []
/** 本模块自己发起的历史回退次数，popstate 里据此跳过 */
let selfPopping = 0
let scheduled = false
let initialized = false

function onSentinel() {
  return (history.state as Record<string, unknown> | null)?.[OVERLAY_FLAG] === true
}

function scheduleSync() {
  if (scheduled) return
  scheduled = true
  queueMicrotask(sync)
}

function sync() {
  scheduled = false
  const diff = pushedCount - openStack.length
  if (diff === 0) return
  if (diff > 0) {
    // 有覆盖层被关闭：弹掉对应数量的哨兵
    if (!onSentinel()) return
    selfPopping++
    pushedCount -= diff
    history.go(-diff)
  } else {
    // 有覆盖层被打开：压入同样数量的哨兵
    for (let i = 0; i < -diff; i++) {
      history.pushState({ [OVERLAY_FLAG]: true }, '')
    }
    pushedCount = openStack.length
  }
}

function onPopState() {
  if (selfPopping > 0) {
    selfPopping--
    return
  }
  // 返回键弹掉的是最上层哨兵，关闭对应的覆盖层
  const top = openStack[openStack.length - 1]
  if (!top) return
  openStack.pop()
  pushedCount = Math.max(0, pushedCount - 1)
  top.close()
}

function init() {
  if (initialized) return
  initialized = true
  if (onSentinel()) history.replaceState(null, '')
  window.addEventListener('popstate', onPopState)
}

/**
 * 给一个覆盖层绑定「返回键关闭」。
 * - isOpen：显隐状态 getter（store 状态或本地 ref 均可）
 * - close：关闭动作，必须最终把 isOpen 变为 false
 *
 * 内部使用 watch，在组件 setup 内调用会随组件卸载自动停止。
 */
export function useBackClose(isOpen: () => boolean, close: () => void) {
  init()
  const binding: OverlayBinding = { close }
  return watch(isOpen, val => {
    if (val) {
      openStack.push(binding)
      scheduleSync()
      return
    }
    const i = openStack.lastIndexOf(binding)
    if (i !== -1) openStack.splice(i, 1)
    scheduleSync()
  })
}
