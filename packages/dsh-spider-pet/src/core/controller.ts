import {
  animationFor,
  type PetActivity,
  type PetAnimation,
} from './state.ts'

export interface PetPersist {
  display: {
    visible: boolean
    size: number
    right: number
    bottom: number
    name: string
  }
}

export const PET_STORAGE_KEY = 'dsh.spiderPet.v1'
/** Shared spider-app master switch (pet + skin), persisted across sessions. */
export const APP_STORAGE_KEY = 'dsh.spiderApp.v1'
export const APP_TOGGLE_EVENT = 'dsh:spider-app-toggle'

export const defaultPersist: PetPersist = {
  display: { visible: true, size: 160, right: 24, bottom: 20, name: 'Peter Parker' },
}

export function loadPersist(
  storage: Pick<Storage, 'getItem'>,
  fallback: PetPersist,
): PetPersist {
  try {
    const raw = storage.getItem(PET_STORAGE_KEY)
    if (!raw) return fallback
    const parsed = JSON.parse(raw) as Partial<PetPersist>
    const storedName = typeof parsed.display?.name === 'string' ? parsed.display.name : undefined
    return {
      display: {
        ...fallback.display,
        ...parsed.display,
        // The old default name was superseded by Peter Parker.
        ...(storedName === '蛛蛛侠' ? { name: fallback.display.name } : {}),
      },
    }
  } catch {
    return fallback
  }
}

export function savePersist(
  storage: Pick<Storage, 'setItem'>,
  persist: PetPersist,
): void {
  try {
    storage.setItem(PET_STORAGE_KEY, JSON.stringify(persist))
  } catch {
    // Storage unavailable (private mode): degrade silently.
  }
}

/** Read the shared spider-app master switch (default on). */
export function readAppEnabled(storage: Pick<Storage, 'getItem'>): boolean {
  try {
    const raw = storage.getItem(APP_STORAGE_KEY)
    if (!raw) return true
    const parsed = JSON.parse(raw) as { enabled?: unknown }
    return parsed.enabled !== false
  } catch {
    return true
  }
}

export interface PetControllerDeps {
  storage: Pick<Storage, 'getItem' | 'setItem'>
  now?: () => number
}

export class PetController {
  private persist: PetPersist
  private appEnabled: boolean
  private activity: PetActivity = 'idle'
  private petTriggeredAt = Number.NEGATIVE_INFINITY
  /** Status phrase/line from the host activity tracker, shown as a bubble. */
  private bubble: string | undefined
  private listeners = new Set<() => void>()
  private readonly now: () => number
  /** How long the pet animation runs after a pet interaction (ms). */
  private readonly petWindowMs = 1600

  constructor(private readonly deps: PetControllerDeps) {
    this.now = deps.now ?? (() => Date.now())
    this.persist = loadPersist(deps.storage, defaultPersist)
    this.appEnabled = readAppEnabled(deps.storage)
  }

  getSnapshot(): {
    persist: PetPersist
    activity: PetActivity
    animation: PetAnimation
    bubble: string | undefined
    appEnabled: boolean
  } {
    const petTriggered = this.now() - this.petTriggeredAt < this.petWindowMs
    const animation = animationFor(this.activity, petTriggered)
    return {
      persist: this.persist,
      activity: this.activity,
      animation,
      bubble: this.bubble,
      appEnabled: this.appEnabled,
    }
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn)
    return () => { this.listeners.delete(fn) }
  }

  setActivity(activity: PetActivity, bubble?: string): void {
    this.activity = activity
    this.bubble = bubble
    this.notify()
  }

  /** Clear the status bubble (after its CSS animation). */
  clearBubble(): void {
    if (this.bubble === undefined) return
    this.bubble = undefined
    this.notify()
  }

  /** Trigger the pet animation (no affinity bookkeeping). */
  interact(): void {
    this.petTriggeredAt = this.now()
    this.notify()
  }

  /** Master switch for the whole spider app (pet + skin). */
  getAppEnabled(): boolean {
    return this.appEnabled
  }

  setAppEnabled(enabled: boolean): void {
    if (this.appEnabled === enabled) return
    this.appEnabled = enabled
    try {
      this.deps.storage.setItem(APP_STORAGE_KEY, JSON.stringify({ enabled }))
    } catch {
      // Storage unavailable: keep in-memory state working this session.
    }
    this.notify()
    window.dispatchEvent(new CustomEvent(APP_TOGGLE_EVENT, { detail: { enabled } }))
  }

  setDisplay(patch: Partial<PetPersist['display']>): void {
    this.persist = { ...this.persist, display: { ...this.persist.display, ...patch } }
    this.persistAndNotify()
  }

  private persistAndNotify(): void {
    savePersist(this.deps.storage, this.persist)
    this.notify()
  }

  private notify(): void {
    for (const fn of [...this.listeners]) fn()
  }
}
