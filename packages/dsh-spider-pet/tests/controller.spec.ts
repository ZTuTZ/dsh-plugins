import { describe, expect, it } from 'vitest'
import { PetController, defaultPersist, loadPersist } from '../src/core/controller.ts'

const fallback = { ...defaultPersist, display: { ...defaultPersist.display, name: 'Peter Parker' } }

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
    expect(p.display.name).toBe('Peter Parker')
  })

  it('parses stored JSON but keeps the fixed pet name', () => {
    const s = memoryStorage(JSON.stringify({ display: { ...fallback.display, name: '小蛛', size: 200 } }))
    const p = loadPersist(s, fallback)
    expect(p.display.size).toBe(200)
    expect(p.display.name).toBe('Peter Parker')
  })
})

describe('PetController', () => {
  it('triggers the pet animation for a window and notifies', () => {
    let now = 0
    const controller = new PetController({ storage: memoryStorage(), now: () => now }, 'Peter Parker')
    const events: string[] = []
    controller.subscribe(() => events.push('change'))
    controller.interact()
    expect(controller.getSnapshot().animation).toBe('jumping')
    expect(events).toContain('change')
    now = 2000
    expect(controller.getSnapshot().animation).toBe('idle')
  })

  it('triggers the pet pose for a window after petting', () => {
    let now = 0
    const controller = new PetController({ storage: memoryStorage(), now: () => now }, 'Peter Parker')
    controller.interactPet()
    expect(controller.getSnapshot().animation).toBe('pet')
    now = 2000
    expect(controller.getSnapshot().animation).toBe('idle')
  })

  it('maps activity to animation', () => {
    const controller = new PetController({ storage: memoryStorage(), now: () => 0 }, 'Peter Parker')
    expect(controller.getSnapshot().animation).toBe('idle')
    controller.setActivity('waiting')
    expect(controller.getSnapshot().animation).toBe('waiting')
    controller.setActivity('thinking')
    expect(controller.getSnapshot().animation).toBe('thinking')
    controller.setActivity('done')
    expect(controller.getSnapshot().animation).toBe('jumping')
    controller.setActivity('failed')
    expect(controller.getSnapshot().animation).toBe('failed')
  })

  it('carries and clears a status bubble', () => {
    const controller = new PetController({ storage: memoryStorage(), now: () => 0 }, 'Peter Parker')
    expect(controller.getSnapshot().bubble).toBeUndefined()
    controller.setActivity('thinking', '正在调用工具…')
    expect(controller.getSnapshot().bubble).toBe('正在调用工具…')
    controller.clearBubble()
    expect(controller.getSnapshot().bubble).toBeUndefined()
  })
})
