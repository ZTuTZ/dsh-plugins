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

const PET_NAME_MAX = 20

export const defaultPersist: PetPersist = {
  display: { visible: true, size: 160, right: 24, bottom: 20, name: '蛛蛛侠' },
}

export function loadPersist(
  storage: Pick<Storage, 'getItem'>,
  fallback: PetPersist,
): PetPersist {
  try {
    const raw = storage.getItem(PET_STORAGE_KEY)
    if (!raw) return fallback
    const parsed = JSON.parse(raw) as Partial<PetPersist>
    return {
      display: { ...fallback.display, ...parsed.display },
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

export interface PetControllerDeps {
  storage: Pick<Storage, 'getItem' | 'setItem'>
  now?: () => number
}

export class PetController {
  private persist: PetPersist
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
  }

  getSnapshot(): {
    persist: PetPersist
    activity: PetActivity
    animation: PetAnimation
    bubble: string | undefined
  } {
    const petTriggered = this.now() - this.petTriggeredAt < this.petWindowMs
    const animation = animationFor(this.activity, petTriggered)
    return {
      persist: this.persist,
      activity: this.activity,
      animation,
      bubble: this.bubble,
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

  setDisplay(patch: Partial<PetPersist['display']>): void {
    this.persist = { ...this.persist, display: { ...this.persist.display, ...patch } }
    this.persistAndNotify()
  }

  rename(name: string): { ok: boolean; error?: string } {
    const trimmed = name.trim()
    if (trimmed === '') return { ok: false, error: '名字不能为空' }
    if (trimmed.length > PET_NAME_MAX) return { ok: false, error: '名字太长' }
    this.setDisplay({ name: trimmed })
    return { ok: true }
  }

  private persistAndNotify(): void {
    savePersist(this.deps.storage, this.persist)
    this.notify()
  }

  private notify(): void {
    for (const fn of [...this.listeners]) fn()
  }
}
