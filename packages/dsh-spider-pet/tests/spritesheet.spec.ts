import { describe, expect, it } from 'vitest'
import { framePosition, totalFrames } from '../src/core/spritesheet.ts'

describe('framePosition', () => {
  const meta = { framesPerRow: 8, cellWidth: 256, cellHeight: 256 }

  it('computes pixel offsets for a frame', () => {
    expect(framePosition(meta, 2, 3)).toEqual({ x: 3 * 256, y: 2 * 256 })
    expect(framePosition(meta, 0, 7)).toEqual({ x: 7 * 256, y: 0 })
  })
})

describe('totalFrames', () => {
  it('sums frame counts', () => {
    expect(totalFrames({ rows: { idle: 0, jumping: 1 }, frames: [6, 4] })).toBe(10)
  })
})
