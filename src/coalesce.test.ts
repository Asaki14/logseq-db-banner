import { describe, expect, it, vi } from 'vitest'
import { createCoalescer, type CoalesceTimers } from './coalesce'

/** Hand-driven timers, so a burst can be arranged tick by tick. */
function fakeTimers() {
  let now = 0
  let nextHandle = 1
  const pending = new Map<number, { at: number; callback: () => void }>()

  const timers: CoalesceTimers = {
    now: () => now,
    set(callback, delayMs) {
      const handle = nextHandle++
      pending.set(handle, { at: now + delayMs, callback })
      return handle
    },
    clear(handle) {
      pending.delete(handle)
    },
  }

  return {
    timers,
    advance(ms: number) {
      now += ms
      for (const [handle, timer] of [...pending]) {
        if (timer.at > now) continue
        pending.delete(handle)
        timer.callback()
      }
    },
    get pendingCount() {
      return pending.size
    },
  }
}

describe('createCoalescer', () => {
  const options = { delayMs: 400, maxDelayMs: 2000 }

  it('runs once after the burst pauses', () => {
    const clock = fakeTimers()
    const run = vi.fn()
    const coalescer = createCoalescer(run, options, clock.timers)

    coalescer.schedule()
    clock.advance(100)
    coalescer.schedule()
    clock.advance(100)
    coalescer.schedule()
    expect(run).not.toHaveBeenCalled()

    clock.advance(400)
    expect(run).toHaveBeenCalledTimes(1)
  })

  it('does not postpone an unbroken burst past the maximum', () => {
    const clock = fakeTimers()
    const run = vi.fn()
    const coalescer = createCoalescer(run, options, clock.timers)

    for (let elapsed = 0; elapsed < 2000; elapsed += 100) {
      coalescer.schedule()
      clock.advance(100)
    }
    expect(run).toHaveBeenCalledTimes(1)
  })

  it('starts a new burst after a run', () => {
    const clock = fakeTimers()
    const run = vi.fn()
    const coalescer = createCoalescer(run, options, clock.timers)

    coalescer.schedule()
    clock.advance(400)
    coalescer.schedule()
    clock.advance(400)
    expect(run).toHaveBeenCalledTimes(2)
  })

  it('cancels a pending run', () => {
    const clock = fakeTimers()
    const run = vi.fn()
    const coalescer = createCoalescer(run, options, clock.timers)

    coalescer.schedule()
    coalescer.cancel()
    clock.advance(5000)
    expect(run).not.toHaveBeenCalled()
    expect(clock.pendingCount).toBe(0)
  })
})
