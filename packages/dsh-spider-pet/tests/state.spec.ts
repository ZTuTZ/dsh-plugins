import { describe, expect, it } from 'vitest'
import { animationFor } from '../src/core/state.ts'

describe('animationFor', () => {
  it('maps activities to animations', () => {
    expect(animationFor('idle', false, false)).toBe('idle')
    expect(animationFor('waiting', false, false)).toBe('waiting')
    expect(animationFor('thinking', false, false)).toBe('thinking')
    expect(animationFor('done', false, false)).toBe('jumping')
    expect(animationFor('pet', false, false)).toBe('pet')
    expect(animationFor('failed', false, false)).toBe('failed')
  })

  it('pet interaction plays the happy jump over idle', () => {
    expect(animationFor('idle', true, false)).toBe('jumping')
    expect(animationFor(undefined, true, false)).toBe('jumping')
  })

  it('petting interaction plays the dedicated pet pose', () => {
    expect(animationFor('idle', false, true)).toBe('pet')
    expect(animationFor(undefined, false, true)).toBe('pet')
    expect(animationFor('idle', true, true)).toBe('pet')
  })

  it('defaults to idle', () => {
    expect(animationFor(undefined, false, false)).toBe('idle')
  })
})
