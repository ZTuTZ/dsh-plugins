import { describe, expect, it } from 'vitest'
import { apply } from '../src/client/index.ts'
import { mountReveal } from '../src/client/reveal.ts'

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

  it('mounts the identity reveal inside the conversation column', () => {
    document.body.innerHTML = '<div class="centerCol"><div data-conversation-scroll></div></div>'
    const dispose = mountReveal({
      peter: 'data:image/webp;base64,AA==',
      suit: 'data:image/webp;base64,AA==',
    })
    const reveal = document.querySelector('[data-dsh-spiderman-reveal]')
    expect(reveal).not.toBeNull()
    expect(reveal?.querySelector('[data-dsh-figure="peter"]')).not.toBeNull()
    expect(reveal?.querySelector('[data-dsh-figure="suit"]')).not.toBeNull()
    expect(reveal?.querySelector('[data-dsh-glow]')).not.toBeNull()
    // chat surface is raised above the background layer
    const surface = document.querySelector<HTMLElement>('[data-conversation-scroll]')
    expect(surface?.style.zIndex).toBe('1')
    dispose()
    expect(document.querySelector('[data-dsh-spiderman-reveal]')).toBeNull()
  })
})
