import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import { APP_STORAGE_KEY, APP_TOGGLE_EVENT, PetController, readAppEnabled } from '../core/controller.ts'
import type { PetActivity } from '../core/state.ts'
import type { FrameTable } from '../core/spritesheet.ts'
import { SPRITE_SHEET_URL } from '../assets/spritesheet.ts'
import { mountPet } from './mount.tsx'
import { PluginSettingsCard } from './PluginSettingsCard.tsx'
import { en, zh, type PetLocaleKey } from './locales.ts'

export const inject = ['slots', 'locale', 'connection', 'remote', 'settingsScope']

const NS = 'spider-pet'

export const SPRITE_META = { framesPerRow: 16, cellWidth: 256, cellHeight: 256 } as const

export const FRAME_TABLE: FrameTable = {
  rows: { idle: 0, waiting: 1, thinking: 2, jumping: 3 },
  frames: [16, 12, 12, 12],
}

/** Host `activity/status` phase → pet activity (`tool` shares the thinking row). */
const PHASE_MAP: Record<string, PetActivity> = {
  idle: 'idle',
  waiting: 'waiting',
  thinking: 'thinking',
  tool: 'thinking',
  done: 'done',
}

const ACTIVITY_STATE_URL = '/api/spider-pet/state'
const POLL_MS = 400

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    'spider-pet': PetLocaleKey
  }

  interface SlotMap {
    'web-ui.plugin.item': { kind: 'list'; scope: 'root'; owner: SettingsPluginItemOwnerProps }
  }
}

export interface SettingsPluginItemOwnerProps {
  children?: never
}

export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'spider-pet: dictionaries')

  const storage = typeof localStorage !== 'undefined' ? localStorage : undefined
  if (storage === undefined) return
  const controller = new PetController({ storage })

  ctx.slots.inject('web-ui.plugin.item', () => ctx.slots.register({
    name: 'web-ui.plugin.item',
    id: 'spider-pet',
    order: 140,
    locale: NS,
    inject: () => ({ scope: settingsScope }),
  }, PluginSettingsCard))

  const settingsScope = ctx.settingsScope.bind<{ enabled?: boolean }>({ namespace: 'spider-pet' })
  let disposer: (() => void) | undefined
  let pollTimer: number | undefined
  let restoreEl: HTMLButtonElement | undefined
  const mountRestore = (): void => {
    if (restoreEl !== undefined) return
    restoreEl = document.createElement('button')
    restoreEl.textContent = '开启蜘蛛侠应用'
    restoreEl.dataset.dshSpiderPetRestore = ''
    restoreEl.style.cssText = [
      'position:fixed', 'right:24px', 'bottom:20px', 'z-index:2147483000',
      'border:1px dashed rgba(255,82,82,.65)', 'background:rgba(20,15,30,.9)',
      'color:#ffb3b3', 'border-radius:999px', 'padding:6px 14px',
      'font-size:12px', 'cursor:pointer',
    ].join(';')
    restoreEl.addEventListener('click', () => { controller.setAppEnabled(true) })
    document.body.appendChild(restoreEl)
  }
  const unmountRestore = (): void => {
    restoreEl?.remove()
    restoreEl = undefined
  }
  const syncEnabled = (): void => {
    const enabled = controller.getAppEnabled()
    if (enabled) {
      if (disposer !== undefined) return
      try {
        unmountRestore()
        disposer = mountPet(controller, SPRITE_META, FRAME_TABLE, SPRITE_SHEET_URL, () => {
          controller.setAppEnabled(false)
        })
        const poll = (): void => {
          fetch(ACTIVITY_STATE_URL)
            .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`status ${res.status}`))))
            .then((state: { phase?: string; phrase?: string; line?: string }) => {
              const activity = state.phase === undefined ? undefined : PHASE_MAP[state.phase]
              if (activity === undefined) return
              let bubble = state.phrase ?? state.line ?? undefined
              // Working without a tool call has no host phrase; show a
              // default status bubble so the pet always says what it is doing.
              if (activity === 'thinking' && bubble === undefined) bubble = '正在思考…'
              controller.setActivity(activity, bubble)
            })
            .catch(() => {
              // Host API unavailable (plugin toggled off / server restarted):
              // the pet keeps its last known animation; next poll resyncs.
            })
        }
        poll()
        pollTimer = window.setInterval(poll, POLL_MS)
      } catch (error) {
        console.error('[dsh-spider-pet] mount failed:', error)
      }
    } else {
      disposer?.()
      disposer = undefined
      if (pollTimer !== undefined) {
        window.clearInterval(pollTimer)
        pollTimer = undefined
      }
      mountRestore()
    }
  }
  const unsubscribe = controller.subscribe(syncEnabled)
  // Keep in sync with a toggle from another tab or the skin plugin.
  const onAppToggle = (event: Event): void => {
    const enabled = (event as CustomEvent<{ enabled?: boolean }>).detail?.enabled
    if (typeof enabled === 'boolean' && enabled !== controller.getAppEnabled()) {
      controller.setAppEnabled(enabled)
    }
  }
  window.addEventListener(APP_TOGGLE_EVENT, onAppToggle)
  window.addEventListener('storage', (event) => {
    if (event.key === APP_STORAGE_KEY) {
      const enabled = readAppEnabled(localStorage)
      if (enabled !== controller.getAppEnabled()) controller.setAppEnabled(enabled)
    }
  })
  syncEnabled()
}
