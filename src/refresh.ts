/**
 * Single-flight coalescing for an async refresh, so a per-second tick and a
 * route-change event cannot leave two host reads racing — out of order, the
 * loser would write a stale decision.
 */

export interface Refresher {
  /** Join the run in flight, or start one. */
  refresh(): Promise<void>
  /**
   * Get a run that starts *after* this call: wait for any run in flight — it may
   * have read the host before whatever prompted this call — then refresh again.
   */
  refreshAfterCurrent(): Promise<void>
}

export function createRefresher(task: () => Promise<void>): Refresher {
  let inFlight: Promise<void> | null = null

  function start(): Promise<void> {
    const run = task().finally(() => {
      if (inFlight === run) inFlight = null
    })
    inFlight = run
    return run
  }

  const refresher: Refresher = {
    refresh() {
      return inFlight ?? start()
    },
    refreshAfterCurrent() {
      const pending = inFlight
      if (!pending) return start()
      // Joining rather than starting keeps a second caller from opening a
      // parallel run; a run started meanwhile is already newer than `pending`.
      const again = () => refresher.refresh()
      return pending.then(again, again)
    },
  }
  return refresher
}
