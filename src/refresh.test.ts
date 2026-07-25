import { describe, expect, it } from 'vitest'
import { createRefresher } from './refresh'

/** A task that records how many runs overlap, and is resolved by the test. */
function trackedTask() {
  const resolvers: Array<(value?: unknown) => void> = []
  const rejecters: Array<(reason: unknown) => void> = []
  const state = { started: 0, running: 0, maxConcurrent: 0 }

  const task = () => {
    state.started += 1
    state.running += 1
    state.maxConcurrent = Math.max(state.maxConcurrent, state.running)
    return new Promise<void>((resolve, reject) => {
      resolvers.push(() => {
        state.running -= 1
        resolve()
      })
      rejecters.push((reason) => {
        state.running -= 1
        reject(reason)
      })
    })
  }

  return {
    task,
    state,
    settleFirst: () => resolvers.shift()?.(),
    rejectFirst: (reason: unknown) => rejecters.shift()?.(reason),
    settleAll: () => {
      while (resolvers.length) resolvers.shift()?.()
    },
  }
}

/** Let queued microtasks run without advancing time. */
const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

describe('createRefresher', () => {
  it('coalesces calls made while a run is in flight', async () => {
    const tracked = trackedTask()
    const refresher = createRefresher(tracked.task)

    const first = refresher.refresh()
    const second = refresher.refresh()
    const third = refresher.refresh()
    expect(tracked.state.started).toBe(1)
    expect(second).toBe(first)
    expect(third).toBe(first)

    tracked.settleAll()
    await Promise.all([first, second, third])
    expect(tracked.state.started).toBe(1)
    expect(tracked.state.maxConcurrent).toBe(1)
  })

  it('starts a fresh run once the previous one has settled', async () => {
    const tracked = trackedTask()
    const refresher = createRefresher(tracked.task)

    const first = refresher.refresh()
    tracked.settleAll()
    await first
    await refreshAndSettle(refresher, tracked)

    expect(tracked.state.started).toBe(2)
    expect(tracked.state.maxConcurrent).toBe(1)
  })

  it('never runs the task twice at once, however the two paths interleave', async () => {
    const tracked = trackedTask()
    const refresher = createRefresher(tracked.task)

    const tick = refresher.refresh()
    const route = refresher.refreshAfterCurrent()
    const laterTick = refresher.refresh()
    const laterRoute = refresher.refreshAfterCurrent()
    expect(tracked.state.started).toBe(1)

    // The tick's run settles; the route-change paths may now start exactly one more.
    tracked.settleFirst()
    await flush()
    expect(tracked.state.started).toBe(2)
    expect(tracked.state.running).toBe(1)

    tracked.settleAll()
    await Promise.all([tick, route, laterTick, laterRoute])
    expect(tracked.state.maxConcurrent).toBe(1)
  })

  it('re-reads after a route change instead of trusting the run already in flight', async () => {
    const tracked = trackedTask()
    const refresher = createRefresher(tracked.task)

    const tick = refresher.refresh()
    const route = refresher.refreshAfterCurrent()

    tracked.settleFirst()
    await tick
    // The route-change caller is still waiting: its own read has not happened yet.
    await flush()
    expect(tracked.state.started).toBe(2)

    tracked.settleAll()
    await route
    expect(tracked.state.started).toBe(2)
  })

  it('starts immediately when nothing is in flight', async () => {
    const tracked = trackedTask()
    const refresher = createRefresher(tracked.task)

    const route = refresher.refreshAfterCurrent()
    expect(tracked.state.started).toBe(1)

    tracked.settleAll()
    await route
  })

  it('clears the in-flight run when the task fails, so the next call retries', async () => {
    const tracked = trackedTask()
    const refresher = createRefresher(tracked.task)

    const failing = refresher.refresh()
    tracked.rejectFirst(new Error('host unreachable'))
    await expect(failing).rejects.toThrow('host unreachable')

    await refreshAndSettle(refresher, tracked)
    expect(tracked.state.started).toBe(2)
    expect(tracked.state.maxConcurrent).toBe(1)
  })
})

async function refreshAndSettle(
  refresher: ReturnType<typeof createRefresher>,
  tracked: ReturnType<typeof trackedTask>,
): Promise<void> {
  const run = refresher.refresh()
  tracked.settleAll()
  await run
}
