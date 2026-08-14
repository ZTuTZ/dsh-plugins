import {
  applyInteraction,
  type AffinityState,
  type PetInteraction,
} from './ledger.ts'
import {
  animationFor,
  type PetActivity,
  type PetAnimation,
} from './state.ts'

export interface PetPersist {
  affinity: AffinityState
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
  affinity: { points: 0, pets: 0, feeds: 0, lastPetAt: Number.NEGATIVE_INFINITY, lastFeedAt: Number.NEGATIVE_INFINITY },
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
      affinity: { ...fallback.affinity, ...parsed.affinity },
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
  private petTriggered = false
  private listeners = new Set<() => void>()
  private readonly now: () => number

  constructor(private readonly deps: PetControllerDeps) {
    this.now = deps.now ?? (() => Date.now())
    this.persist = loadPersist(deps.storage, defaultPersist)
  }

  getSnapshot(): {
    persist: PetPersist
    activity: PetActivity
    petTriggered: boolean
    animation: PetAnimation
  } {
    const animation = animationFor(this.activity, this.petTriggered)
    this.petTriggered = false
    return { persist: this.persist, activity: this.activity, petTriggered: animation === 'pet', animation }
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn)
    return () => { this.listeners.delete(fn) }
  }

  setActivity(activity: PetActivity): void {
    if (this.activity === activity) return
    this.activity = activity
    this.notify()
  }

  interact(kind: PetInteraction): { granted: boolean; reason?: string } {
    const result = applyInteraction(this.persist.affinity, kind, this.now())
    if (!result.granted) return result
    this.persist = { ...this.persist, affinity: result.state }
    if (kind === 'pet') this.petTriggered = true
    this.persistAndNotify()
    return { granted: true }
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
