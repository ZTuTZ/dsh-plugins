import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import { PetController } from '../core/controller.ts'
import type { PetActivity } from '../core/state.ts'
import type { FrameTable } from '../core/spritesheet.ts'
import { SPRITE_SHEET_URL } from '../assets/spritesheet.ts'
import { mountPet } from './mount.tsx'
import { PluginSettingsCard } from './PluginSettingsCard.tsx'
import { en, zh, type PetLocaleKey } from './locales.ts'

export const inject = ['slots', 'locale', 'settingsScope']

const NS = 'spider-pet'

export const SPRITE_META = { framesPerRow: 8, cellWidth: 256, cellHeight: 256 } as const

export const FRAME_TABLE: FrameTable = {
  rows: { idle: 0, waiting: 1, thinking: 2, jumping: 3, pet: 4 },
  frames: [8, 6, 6, 6, 5],
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
    inject: () => ({ controller }),
  }, PluginSettingsCard))

  const settingsScope = ctx.settingsScope.bind<{ enabled?: boolean }>({ namespace: 'spider-pet' })
  let disposer: (() => void) | undefined
  let pollTimer: number | undefined
  const syncEnabled = (): void => {
    const scope = settingsScope.getSnapshot()
    const enabled = scope.status === 'ready' ? (scope.value?.enabled ?? true) : true
    if (enabled) {
      if (disposer !== undefined) return
      try {
        disposer = mountPet(controller, SPRITE_META, FRAME_TABLE, SPRITE_SHEET_URL)
        const poll = (): void => {
          fetch(ACTIVITY_STATE_URL)
            .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`status ${res.status}`))))
            .then((state: { phase?: string; phrase?: string; line?: string }) => {
              const activity = state.phase === undefined ? undefined : PHASE_MAP[state.phase]
              if (activity === undefined) return
              controller.setActivity(activity, state.phrase ?? state.line ?? undefined)
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
    }
  }
  settingsScope.subscribe(syncEnabled)
  syncEnabled()
}
