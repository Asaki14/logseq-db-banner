/**
 * A one-slot async cache, so a widget that needs host data does not re-query on
 * every tick of the per-second render loop.
 *
 * Reads are synchronous and stale-tolerant: `peek` hands back whatever is stored
 * for the key so the widget keeps rendering while a refresh runs. `ensure` starts
 * a load only when the key changed or the stored entry aged past its TTL, and
 * coalesces concurrent callers into one in-flight load. A failed load is stored
 * as "no value" and is TTL-bounded too, so a broken query is retried on a timer
 * instead of on every tick.
 *
 * `invalidate` marks the entry stale rather than dropping it: the next `ensure`
 * reloads it, but `peek` keeps answering with the last value in the meantime.
 * Dropping it instead made a widget that renders nothing without data disappear
 * for the ticks between the invalidation and the reload, which rebuilt the whole
 * widget DOM twice per navigation — and a rebuild between mousedown and mouseup
 * swallows the click.
 */

export interface AsyncCache {
  /** The value stored for `key`, or `undefined` when nothing is stored yet. */
  peek(key: string): unknown
  /** Load `key` unless a fresh entry or an in-flight load already covers it. */
  ensure(key: string, ttlMs: number, load: () => Promise<unknown>): Promise<void>
  /**
   * Mark the stored entry stale and discard loads in flight. `peek` keeps
   * returning the stale value until the reload the next `ensure` starts lands.
   */
  invalidate(): void
}

interface Entry {
  key: string
  value: unknown
  storedAt: number
  /** Set by `invalidate`: the value is still shown, but a reload is due. */
  stale: boolean
}

export function createAsyncCache(now: () => number = Date.now): AsyncCache {
  let entry: Entry | null = null
  let inFlightKey: string | null = null
  let inFlight: Promise<void> | null = null
  /** Bumped by `invalidate`, so a load started before it is thrown away. */
  let generation = 0

  return {
    peek(key) {
      return entry && entry.key === key ? entry.value : undefined
    },

    ensure(key, ttlMs, load) {
      if (
        entry &&
        entry.key === key &&
        !entry.stale &&
        now() - entry.storedAt < ttlMs
      ) {
        return Promise.resolve()
      }
      if (inFlight && inFlightKey === key) return inFlight

      const startedAt = generation
      // A load for a key that has since been superseded, or one that started
      // before an `invalidate`, must not write over the current entry.
      const store = (value: unknown) => {
        if (generation === startedAt && inFlightKey === key) {
          entry = { key, value, storedAt: now(), stale: false }
        }
      }
      const settle: Promise<void> = load()
        .then(store, (error) => {
          console.warn('[db-banner] Widget data could not be loaded', key, error)
          // Remembering the failure keeps the tick loop from retrying at 1 Hz.
          store(undefined)
        })
        .finally(() => {
          if (inFlight === settle) {
            inFlight = null
            inFlightKey = null
          }
        })
      inFlight = settle
      inFlightKey = key
      return settle
    },

    invalidate() {
      if (entry) entry.stale = true
      generation += 1
      // Dropping the in-flight load lets the next `ensure` start a fresh one at
      // once; the discarded one can no longer write, its generation is behind.
      inFlight = null
      inFlightKey = null
    },
  }
}
