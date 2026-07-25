import { describe, expect, it, vi } from 'vitest'
import { createAsyncCache } from './cache'

/** A clock the test advances by hand, so TTLs need no real waiting. */
function fakeClock(start = 1_000) {
  let now = start
  return {
    now: () => now,
    advance(ms: number) {
      now += ms
    },
  }
}

/** A loader that resolves on demand, so overlapping loads can be arranged. */
function deferredLoader() {
  const resolvers: ((value: unknown) => void)[] = []
  const load = vi.fn(
    () => new Promise<unknown>((resolve) => resolvers.push(resolve)),
  )
  return {
    load,
    settle(index: number, value: unknown) {
      resolvers[index](value)
      return Promise.resolve()
    },
  }
}

describe('createAsyncCache', () => {
  it('has nothing to peek before a load settles', async () => {
    const cache = createAsyncCache()
    const pending = cache.ensure('a', 1000, () => Promise.resolve('loaded'))
    expect(cache.peek('a')).toBeUndefined()

    await pending
    expect(cache.peek('a')).toBe('loaded')
  })

  it('loads once while the entry is fresh', async () => {
    const clock = fakeClock()
    const load = vi.fn(() => Promise.resolve('value'))
    const cache = createAsyncCache(clock.now)

    await cache.ensure('a', 1000, load)
    clock.advance(999)
    await cache.ensure('a', 1000, load)
    expect(load).toHaveBeenCalledTimes(1)
  })

  it('reloads once the TTL has passed', async () => {
    const clock = fakeClock()
    const load = vi.fn(() => Promise.resolve('value'))
    const cache = createAsyncCache(clock.now)

    await cache.ensure('a', 1000, load)
    clock.advance(1000)
    await cache.ensure('a', 1000, load)
    expect(load).toHaveBeenCalledTimes(2)
  })

  it('reloads when the key changes, and forgets the old key', async () => {
    const cache = createAsyncCache()
    await cache.ensure('july', 1000, () => Promise.resolve('july data'))
    await cache.ensure('august', 1000, () => Promise.resolve('august data'))

    expect(cache.peek('august')).toBe('august data')
    expect(cache.peek('july')).toBeUndefined()
  })

  it('coalesces concurrent callers into one load', async () => {
    const deferred = deferredLoader()
    const cache = createAsyncCache()

    const first = cache.ensure('a', 1000, deferred.load)
    const second = cache.ensure('a', 1000, deferred.load)
    expect(deferred.load).toHaveBeenCalledTimes(1)

    await deferred.settle(0, 'value')
    await Promise.all([first, second])
    expect(cache.peek('a')).toBe('value')
  })

  it('keeps serving the stale value while a refresh runs', async () => {
    const clock = fakeClock()
    const deferred = deferredLoader()
    const cache = createAsyncCache(clock.now)

    await cache.ensure('a', 1000, () => Promise.resolve('old'))
    clock.advance(2000)
    const refresh = cache.ensure('a', 1000, deferred.load)
    expect(cache.peek('a')).toBe('old')

    await deferred.settle(0, 'new')
    await refresh
    expect(cache.peek('a')).toBe('new')
  })

  it('records a failed load and does not retry until the TTL expires', async () => {
    const clock = fakeClock()
    const load = vi.fn(() => Promise.reject(new Error('query failed')))
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const cache = createAsyncCache(clock.now)

    await cache.ensure('a', 1000, load)
    expect(cache.peek('a')).toBeUndefined()

    clock.advance(500)
    await cache.ensure('a', 1000, load)
    expect(load).toHaveBeenCalledTimes(1)

    clock.advance(500)
    await cache.ensure('a', 1000, load)
    expect(load).toHaveBeenCalledTimes(2)
    warn.mockRestore()
  })

  it('re-reads after invalidate, even inside the TTL', async () => {
    const clock = fakeClock()
    const load = vi.fn(() => Promise.resolve('value'))
    const cache = createAsyncCache(clock.now)

    await cache.ensure('a', 10_000, load)
    cache.invalidate()

    await cache.ensure('a', 10_000, load)
    expect(load).toHaveBeenCalledTimes(2)
  })

  it('keeps serving the invalidated value until the reload lands', async () => {
    const deferred = deferredLoader()
    const cache = createAsyncCache()

    await cache.ensure('a', 10_000, () => Promise.resolve('old'))
    cache.invalidate()
    // Nothing may disappear from the render between an invalidate and its reload:
    // a widget dropping out rebuilds the widget DOM and swallows a click in flight.
    expect(cache.peek('a')).toBe('old')

    const reload = cache.ensure('a', 10_000, deferred.load)
    expect(cache.peek('a')).toBe('old')

    await deferred.settle(0, 'new')
    await reload
    expect(cache.peek('a')).toBe('new')
  })

  it('starts a fresh load right after invalidate, without waiting out the discarded one', async () => {
    const deferred = deferredLoader()
    const cache = createAsyncCache()

    const discarded = cache.ensure('a', 10_000, deferred.load)
    cache.invalidate()
    const reload = cache.ensure('a', 10_000, deferred.load)
    expect(deferred.load).toHaveBeenCalledTimes(2)

    await deferred.settle(0, 'read before the invalidate')
    await discarded
    await deferred.settle(1, 'read after the invalidate')
    await reload

    expect(cache.peek('a')).toBe('read after the invalidate')
  })

  it('discards a load that was already running when invalidate was called', async () => {
    const deferred = deferredLoader()
    const cache = createAsyncCache()

    const stale = cache.ensure('a', 10_000, deferred.load)
    cache.invalidate()
    await deferred.settle(0, 'read before the invalidate')
    await stale

    expect(cache.peek('a')).toBeUndefined()
  })

  it('does not let a superseded key overwrite the current entry', async () => {
    const deferred = deferredLoader()
    const cache = createAsyncCache()

    const july = cache.ensure('july', 10_000, deferred.load)
    const august = cache.ensure('august', 10_000, deferred.load)

    // The August read finishes first, then the stale July one lands.
    await deferred.settle(1, 'august data')
    await august
    await deferred.settle(0, 'july data')
    await july

    expect(cache.peek('august')).toBe('august data')
    expect(cache.peek('july')).toBeUndefined()
  })
})
