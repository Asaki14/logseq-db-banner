/**
 * Trailing coalescer for a burst of events.
 *
 * `logseq.DB.onChanged` fires once per transaction, and typing a block produces
 * a stream of them, so the graph-backed widget data is refreshed once the burst
 * pauses rather than once per keystroke. `maxDelayMs` bounds an uninterrupted
 * burst: continuous typing still gets a refresh on that interval instead of
 * postponing it forever.
 */

export interface Coalescer {
  /** Ask for a run; a run already pending is pushed back, within the maximum. */
  schedule(): void
  cancel(): void
}

export interface CoalesceTimers {
  now(): number
  set(callback: () => void, delayMs: number): number
  clear(handle: number): void
}

const wallClockTimers: CoalesceTimers = {
  now: () => Date.now(),
  set: (callback, delayMs) => window.setTimeout(callback, delayMs),
  clear: (handle) => window.clearTimeout(handle),
}

export function createCoalescer(
  run: () => void,
  options: { delayMs: number; maxDelayMs: number },
  timers: CoalesceTimers = wallClockTimers,
): Coalescer {
  let handle: number | null = null
  let burstStartedAt = 0

  return {
    schedule() {
      const now = timers.now()
      if (handle === null) burstStartedAt = now
      else timers.clear(handle)

      const untilMaximum = Math.max(
        0,
        options.maxDelayMs - (now - burstStartedAt),
      )
      handle = timers.set(() => {
        handle = null
        run()
      }, Math.min(options.delayMs, untilMaximum))
    },

    cancel() {
      if (handle === null) return
      timers.clear(handle)
      handle = null
    },
  }
}
