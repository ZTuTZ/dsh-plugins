import { describe, expect, it } from 'vitest'
import { PetController, loadPersist, type PetPersist } from '../src/core/controller.ts'

const fallback: PetPersist = {
  affinity: { points: 0, pets: 0, feeds: 0, lastPetAt: Number.NEGATIVE_INFINITY, lastFeedAt: Number.NEGATIVE_INFINITY },
  display: { visible: true, size: 160, right: 24, bottom: 20, name: '蛛蛛侠' },
}

function memoryStorage(initial?: string): Storage {
  let value = initial ?? null
  return {
    getItem: () => value,
    setItem: (_k, v) => { value = v },
    removeItem: () => { value = null },
    clear: () => { value = null },
    key: () => null,
    length: 0,
  }
}

describe('loadPersist', () => {
  it('falls back to defaults on empty storage', () => {
    const p = loadPersist(memoryStorage(), fallback)
    expect(p.display.name).toBe('蛛蛛侠')
  })

  it('parses stored JSON', () => {
    const s = memoryStorage(JSON.stringify({ ...fallback, display: { ...fallback.display, name: '小蛛' } }))
    expect(loadPersist(s, fallback).display.name).toBe('小蛛')
  })
})

describe('PetController', () => {
  it('persists and notifies on interaction', () => {
    let now = 0
    const controller = new PetController({ storage: memoryStorage(), now: () => now })
    const events: string[] = []
    controller.subscribe(() => events.push('change'))
    const r = controller.interact('pet')
    expect(r.granted).toBe(true)
    expect(controller.getSnapshot().persist.affinity.points).toBe(1)
    expect(events).toContain('change')
  })

  it('renames within length bounds', () => {
    const controller = new PetController({ storage: memoryStorage(), now: () => 0 })
    expect(controller.rename('小蛛').ok).toBe(true)
    expect(controller.getSnapshot().persist.display.name).toBe('小蛛')
    expect(controller.rename('').ok).toBe(false)
    expect(controller.rename('x'.repeat(21)).ok).toBe(false)
  })

  it('maps activity to animation and clears pet trigger after snapshot', () => {
    const controller = new PetController({ storage: memoryStorage(), now: () => 0 })
    controller.interact('pet')
    controller.setActivity('idle')
    expect(controller.getSnapshot().animation).toBe('pet')
    expect(controller.getSnapshot().animation).toBe('idle')
    controller.setActivity('done')
    expect(controller.getSnapshot().animation).toBe('jumping')
  })
})
