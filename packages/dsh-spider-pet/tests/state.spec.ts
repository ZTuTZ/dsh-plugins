import { describe, expect, it } from 'vitest'
import { animationFor } from '../src/core/state.ts'

describe('animationFor', () => {
  it('maps activities to animations', () => {
    expect(animationFor('idle', false)).toBe('idle')
    expect(animationFor('waiting', false)).toBe('waiting')
    expect(animationFor('thinking', false)).toBe('thinking')
    expect(animationFor('done', false)).toBe('jumping')
  })

  it('pet interaction plays the happy jump over idle', () => {
    expect(animationFor('idle', true)).toBe('jumping')
    expect(animationFor(undefined, true)).toBe('jumping')
  })

  it('defaults to idle', () => {
    expect(animationFor(undefined, false)).toBe('idle')
  })
})
