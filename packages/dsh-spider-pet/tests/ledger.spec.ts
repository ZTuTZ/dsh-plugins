import { describe, expect, it } from 'vitest'
import { applyInteraction, rankOf, type AffinityState } from '../src/core/ledger.ts'

const base: AffinityState = { points: 0, pets: 0, feeds: 0, lastPetAt: Number.NEGATIVE_INFINITY, lastFeedAt: Number.NEGATIVE_INFINITY }

describe('applyInteraction', () => {
  it('grants pet points on first pet', () => {
    const r = applyInteraction(base, 'pet', 0)
    expect(r.granted).toBe(true)
    expect(r.state.points).toBe(1)
    expect(r.state.pets).toBe(1)
    expect(r.state.lastPetAt).toBe(0)
  })

  it('rejects pet during cooldown', () => {
    const r1 = applyInteraction(base, 'pet', 0)
    const r2 = applyInteraction(r1.state, 'pet', 0 + 5000)
    expect(r2.granted).toBe(false)
    expect(r2.reason).toMatch(/冷却/)
    expect(r2.state.points).toBe(1)
  })

  it('grants feed points and resets feed cooldown', () => {
    const r = applyInteraction(base, 'feed', 0)
    expect(r.granted).toBe(true)
    expect(r.state.points).toBe(5)
    expect(r.state.feeds).toBe(1)
    expect(r.state.lastFeedAt).toBe(0)
  })

  it('caps points at maxPoints', () => {
    const r = applyInteraction({ ...base, points: 98 }, 'feed', 30_000)
    expect(r.state.points).toBe(100)
  })
})

describe('rankOf', () => {
  it('returns rank names by threshold', () => {
    expect(rankOf(0)).toBe('幼蛛')
    expect(rankOf(30)).toBe('伙伴')
    expect(rankOf(60)).toBe('挚友')
    expect(rankOf(100)).toBe('羁绊')
  })
})
