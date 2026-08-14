import { describe, expect, it } from 'vitest'
import { apply } from '../src/client/index.ts'

function createCtx() {
  let disposer: (() => void) | undefined
  return {
    effect(fn: () => (() => void) | void) {
      const ret = fn()
      if (typeof ret === 'function') disposer = ret
      return ret
    },
    dispose() { disposer?.() },
  }
}

describe('spiderman skin apply/dispose', () => {
  it('sets and clears the body attribute', () => {
    document.body.innerHTML = ''
    const ctx = createCtx() as never
    apply(ctx)
    expect(document.body.dataset.dshSpiderman).toBe('')
    ;(ctx as { dispose(): void }).dispose()
    expect(document.body.dataset.dshSpiderman).toBeUndefined()
  })

  it('removes injected chrome on dispose', () => {
    document.body.innerHTML = ''
    const ctx = createCtx() as never
    apply(ctx)
    expect(document.querySelector('[data-dsh-spiderman-chrome]')).not.toBeNull()
    ;(ctx as { dispose(): void }).dispose()
    expect(document.querySelector('[data-dsh-spiderman-chrome]')).toBeNull()
  })
})
