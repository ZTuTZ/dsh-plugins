import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Context } from '@deepseek-ai/cordis'
import { makePetActivity } from '../src/index.ts'

/** Minimal Context stand-in: records handlers per event name and can emit. */
function mockCtx(): {
  ctx: Context
  emit: (event: string, ...args: unknown[]) => void
} {
  const handlers = new Map<string, Array<(...args: unknown[]) => void>>()
  return {
    ctx: {
      on: (event: string, handler: (...args: unknown[]) => void) => {
        const list = handlers.get(event) ?? []
        list.push(handler)
        handlers.set(event, list)
        return () => {}
      },
    } as unknown as Context,
    emit: (event: string, ...args: unknown[]) => {
      for (const handler of handlers.get(event) ?? []) handler(...args)
    },
  }
}

afterEach(() => {
  vi.useRealTimers()
})

describe('makePetActivity', () => {
  it('maps turn/tool/user events onto pet phases', () => {
    const { ctx, emit } = mockCtx()
    const tracker = makePetActivity(ctx)
    expect(tracker.state().phase).toBe('idle')

    emit('session/event', {}, { type: 'turn/start', data: { turn: 1 } })
    expect(tracker.state().phase).toBe('thinking')

    emit('session/event', {}, { type: 'tool/call', data: { turn: 1, step: 1, name: 'exec_command' } })
    expect(tracker.state()).toEqual({ phase: 'thinking', phrase: '正在调用 exec_command' })

    emit('session/event', {}, { type: 'tool/result', data: { turn: 1, step: 1 } })
    expect(tracker.state().phase).toBe('thinking')
    expect(tracker.state().phrase).toBeUndefined()

    emit('session/event', {}, { type: 'turn/end', data: { turn: 1, reason: 'ok' } })
    expect(tracker.state().phase).toBe('done')

    emit('session/event', {}, { type: 'user/message', data: {} })
    expect(tracker.state().phase).toBe('waiting')

    emit('session/disposed', {})
    expect(tracker.state().phase).toBe('idle')
  })

  it('settles the celebration back to waiting after the window', () => {
    vi.useFakeTimers()
    vi.setSystemTime(1_000_000)
    const { ctx, emit } = mockCtx()
    const tracker = makePetActivity(ctx)
    emit('session/event', {}, { type: 'turn/end', data: { turn: 1, reason: 'ok' } })
    expect(tracker.state().phase).toBe('done')
    vi.advanceTimersByTime(2_500)
    expect(tracker.state().phase).toBe('waiting')
    tracker.dispose()
  })

  it('holds the waiting pose through the minimum window when the turn starts', () => {
    vi.useFakeTimers()
    vi.setSystemTime(1_000_000)
    const { ctx, emit } = mockCtx()
    const tracker = makePetActivity(ctx)
    emit('session/event', {}, { type: 'user/message', data: {} })
    expect(tracker.state().phase).toBe('waiting')
    emit('session/event', {}, { type: 'turn/start', data: { turn: 1 } })
    expect(tracker.state().phase).toBe('waiting')
    vi.advanceTimersByTime(1_300)
    expect(tracker.state().phase).toBe('thinking')
    tracker.dispose()
  })

  it('shows the failed pose when a turn ends with an error, then waits', () => {
    vi.useFakeTimers()
    vi.setSystemTime(1_000_000)
    const { ctx, emit } = mockCtx()
    const tracker = makePetActivity(ctx)
    emit('session/event', {}, { type: 'turn/end', data: { turn: 1, reason: { kind: 'error' } } })
    expect(tracker.state().phase).toBe('failed')
    vi.advanceTimersByTime(3_100)
    expect(tracker.state().phase).toBe('waiting')
    tracker.dispose()
  })
})
