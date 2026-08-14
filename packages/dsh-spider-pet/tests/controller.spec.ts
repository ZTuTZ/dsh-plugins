import { describe, expect, it } from 'vitest'
import { PetController, loadPersist, type PetPersist } from '../src/core/controller.ts'

const fallback: PetPersist = {
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
    const s = memoryStorage(JSON.stringify({ display: { ...fallback.display, name: '小蛛' } }))
    expect(loadPersist(s, fallback).display.name).toBe('小蛛')
  })
})

describe('PetController', () => {
  it('triggers the pet animation for a window and notifies', () => {
    let now = 0
    const controller = new PetController({ storage: memoryStorage(), now: () => now })
    const events: string[] = []
    controller.subscribe(() => events.push('change'))
    controller.interact()
    expect(controller.getSnapshot().animation).toBe('pet')
    expect(events).toContain('change')
    now = 2000
    expect(controller.getSnapshot().animation).toBe('idle')
  })

  it('renames within length bounds', () => {
    const controller = new PetController({ storage: memoryStorage(), now: () => 0 })
    expect(controller.rename('小蛛').ok).toBe(true)
    expect(controller.getSnapshot().persist.display.name).toBe('小蛛')
    expect(controller.rename('').ok).toBe(false)
    expect(controller.rename('x'.repeat(21)).ok).toBe(false)
  })

  it('maps activity to animation', () => {
    const controller = new PetController({ storage: memoryStorage(), now: () => 0 })
    expect(controller.getSnapshot().animation).toBe('idle')
    controller.setActivity('waiting')
    expect(controller.getSnapshot().animation).toBe('waiting')
    controller.setActivity('thinking')
    expect(controller.getSnapshot().animation).toBe('thinking')
    controller.setActivity('done')
    expect(controller.getSnapshot().animation).toBe('jumping')
  })

  it('carries and clears a status bubble', () => {
    const controller = new PetController({ storage: memoryStorage(), now: () => 0 })
    expect(controller.getSnapshot().bubble).toBeUndefined()
    controller.setActivity('thinking', '正在调用工具…')
    expect(controller.getSnapshot().bubble).toBe('正在调用工具…')
    controller.clearBubble()
    expect(controller.getSnapshot().bubble).toBeUndefined()
  })
})
