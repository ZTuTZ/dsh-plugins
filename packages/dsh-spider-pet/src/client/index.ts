import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import { APP_STORAGE_KEY, APP_TOGGLE_EVENT, PetController, readAppEnabled } from '../core/controller.ts'
import {
  MARVEL_PET_EVENT,
  MARVEL_STORAGE_KEY,
  readMarvelSelections,
} from '../core/marvel.ts'
import type { PetActivity } from '../core/state.ts'
import type { HeroPetContent } from '../core/content.ts'
import { HERO_PETS } from '../heroes/spiderman.ts'
import { mountPet } from './mount.tsx'
import { MarvelSettingsTab } from './MarvelSettingsTab.tsx'
import { PluginSettingsCard } from './PluginSettingsCard.tsx'
import { zh, en, type PetLocaleKey } from './locales.ts'

export const inject = ['slots', 'locale', 'connection', 'remote', 'settingsScope']

const NS = 'spider-pet'

/** Host `activity/status` phase → pet activity (`tool` shares the thinking row). */
const PHASE_MAP: Record<string, PetActivity> = {
  idle: 'idle',
  waiting: 'waiting',
  thinking: 'thinking',
  tool: 'thinking',
  done: 'done',
  pet: 'pet',
  failed: 'failed',
}

const ACTIVITY_STATE_URL = '/api/spider-pet/state'
const POLL_MS = 400
/** Pet status broadcast consumed by the skin plugin's sidebar status row.
 *  The same constant is duplicated in dsh-skin-spiderman because cross-plugin
 *  value imports are forbidden by the client purity gate. */
const PET_STATUS_EVENT = 'dsh:marvel-pet-status'

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
  const initial = readMarvelSelections(storage)
  const initialContent = HERO_PETS[initial.pet] ?? HERO_PETS.spiderman
  const controller = new PetController({ storage }, initialContent.name)

  // One tab inside the official Plugins settings page: the Marvel control
  // center (master switch + pet picker + skin picker).
  ctx.slots.inject('settings.plugins.tab', () => ctx.slots.register({
    name: 'settings.plugins.tab',
    id: 'marvel-app',
    order: 30,
    label: () => '漫威',
    locale: NS,
    inject: () => ({}),
  }, MarvelSettingsTab))

  ctx.slots.inject('web-ui.plugin.item', () => ctx.slots.register({
    name: 'web-ui.plugin.item',
    id: 'spider-pet',
    order: 140,
    locale: NS,
    inject: () => ({ scope: settingsScope }),
  }, PluginSettingsCard))

  const settingsScope = ctx.settingsScope.bind<{ enabled?: boolean }>({ namespace: 'spider-pet' })
  let petMount: (() => void) | undefined
  let pollTimer: number | undefined
  /** Removes the visibilitychange listener installed by the current pet. */
  let visibilityCleanup: (() => void) | undefined
  let lastPetId = initial.pet
  /**
   * Re-entrancy guard: startPet() calls controller.setDisplay(), which
   * notifies the subscribed syncEnabled() listener before petMount is
   * assigned. Without this guard the listener re-enters startPet() and the
   * recursion mounts a pet (and leaks its rAF/fetch loops) at every stack
   * level — the whole page grinds to a halt.
   */
  let mounting = false

  const currentContent = (): HeroPetContent => {
    const selections = readMarvelSelections(storage)
    return HERO_PETS[selections.pet] ?? HERO_PETS.spiderman
  }

  const pollActivity = (): void => {
    // Abort after 3s so a hung host never leaves an in-flight request
    // behind; the next poll resyncs.
    const abortCtl = new AbortController()
    const timeout = window.setTimeout(() => abortCtl.abort(), 3000)
    fetch(ACTIVITY_STATE_URL, { signal: abortCtl.signal })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`status ${res.status}`))))
      .then((state: { phase?: string; phrase?: string; line?: string }) => {
        const activity = state.phase === undefined ? undefined : PHASE_MAP[state.phase]
        if (activity === undefined) return
        let bubble = state.phrase ?? state.line ?? undefined
        // Working without a tool call has no host phrase; show a default
        // status bubble so the pet always says what it is doing.
        if (activity === 'thinking' && bubble === undefined) bubble = '正在思考…'
        controller.setActivity(activity, bubble)
      })
      .catch(() => {
        // Host API unavailable (plugin toggled off / server restarted):
        // the pet keeps its last known animation; next poll resyncs.
      })
      .finally(() => window.clearTimeout(timeout))
  }

  const startPolling = (): void => {
    if (pollTimer === undefined) pollTimer = window.setInterval(pollActivity, POLL_MS)
  }

  const stopPolling = (): void => {
    if (pollTimer !== undefined) {
      window.clearInterval(pollTimer)
      pollTimer = undefined
    }
  }

  // Pause polling while the page is hidden; resume (with an immediate
  // refresh) when it becomes visible again.
  const onVisibility = (): void => {
    if (document.hidden) stopPolling()
    else {
      pollActivity()
      startPolling()
    }
  }

  const stopPet = (): void => {
    petMount?.()
    petMount = undefined
    stopPolling()
    visibilityCleanup?.()
  }

  const startPet = (): void => {
    if (mounting) return
    mounting = true
    try {
      const content = currentContent()
      lastPetId = content.id
      controller.setDisplay({ name: content.name })
      petMount = mountPet(controller, content.meta, content.table, content.spriteUrl)
      document.addEventListener('visibilitychange', onVisibility)
      visibilityCleanup = () => document.removeEventListener('visibilitychange', onVisibility)
      pollActivity()
      startPolling()
    } finally {
      mounting = false
    }
  }

  const syncEnabled = (): void => {
    const enabled = controller.getAppEnabled()
    if (enabled) {
      if (petMount !== undefined || pollTimer !== undefined) return
      try {
        startPet()
      } catch (error) {
        console.error('[dsh-spider-pet] mount failed:', error)
      }
    } else {
      stopPet()
    }
  }

  /** Pet selection changed: swap sprite/frames/name without losing position. */
  const resyncPet = (): void => {
    const next = readMarvelSelections(storage).pet
    if (next === lastPetId || !controller.getAppEnabled()) return
    stopPet()
    startPet()
  }

  const unsubscribe = controller.subscribe(syncEnabled)
  // Mirror pet state (name / activity / visibility) to the skin plugin so the
  // sidebar status row stays live instead of showing a static "在线".
  let lastStatusKey = ''
  const broadcastPetStatus = (): void => {
    const snapshot = controller.getSnapshot()
    const name = snapshot.persist.display.name
    const key = `${name}|${snapshot.activity}|${snapshot.persist.display.visible}|${snapshot.appEnabled}`
    if (key === lastStatusKey) return
    lastStatusKey = key
    window.dispatchEvent(new CustomEvent(PET_STATUS_EVENT, {
      detail: {
        name,
        activity: snapshot.activity,
        visible: snapshot.persist.display.visible,
        appEnabled: snapshot.appEnabled,
      },
    }))
  }
  const unsubscribeStatus = controller.subscribe(broadcastPetStatus)
  // Keep in sync with a toggle from another tab or the skin plugin.
  const onAppToggle = (event: Event): void => {
    const enabled = (event as CustomEvent<{ enabled?: boolean }>).detail?.enabled
    if (typeof enabled === 'boolean' && enabled !== controller.getAppEnabled()) {
      controller.setAppEnabled(enabled)
    }
  }
  const onPetChange = (event: Event): void => {
    const id = (event as CustomEvent<{ id?: string }>).detail?.id
    if (typeof id === 'string') resyncPet()
  }
  const onStorage = (event: StorageEvent): void => {
    if (event.key === APP_STORAGE_KEY) {
      const enabled = readAppEnabled(localStorage)
      if (enabled !== controller.getAppEnabled()) controller.setAppEnabled(enabled)
    } else if (event.key === MARVEL_STORAGE_KEY) {
      resyncPet()
    }
  }
  window.addEventListener(APP_TOGGLE_EVENT, onAppToggle)
  window.addEventListener(MARVEL_PET_EVENT, onPetChange)
  window.addEventListener('storage', onStorage)
  syncEnabled()

  // Tear everything down when the plugin is unloaded: listeners, poller,
  // visibility hook, and the mounted pet DOM.
  ctx.effect(() => () => {
    window.removeEventListener(APP_TOGGLE_EVENT, onAppToggle)
    window.removeEventListener(MARVEL_PET_EVENT, onPetChange)
    window.removeEventListener('storage', onStorage)
    unsubscribe()
    unsubscribeStatus()
    stopPet()
  }, 'spider-pet: teardown')
}
