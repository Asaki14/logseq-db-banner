import { describe, expect, it } from 'vitest'
import { classifyGraph, createGraphGate, type GraphSupport } from './graph'

/** Let queued microtasks run without advancing time. */
const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

/** A probe the test answers, one call at a time. */
function scriptedProbe() {
  interface Pending {
    resolve(support: GraphSupport): void
    reject(reason: unknown): void
  }
  const pending: Pending[] = []
  const state = { calls: 0 }

  const probe = () => {
    state.calls += 1
    return new Promise<GraphSupport>((resolve, reject) => {
      pending.push({ resolve, reject })
    })
  }

  return {
    probe,
    state,
    answer: (support: GraphSupport) => pending.shift()?.resolve(support),
    fail: (reason: unknown) => pending.shift()?.reject(reason),
  }
}

describe('classifyGraph', () => {
  it('treats a missing graph as undecided, whatever the DB answer is', () => {
    expect(classifyGraph(null, false)).toBe('unknown')
    expect(classifyGraph(undefined, false)).toBe('unknown')
    expect(classifyGraph(null, true)).toBe('unknown')
  })

  it('reads the DB answer once a graph is loaded', () => {
    expect(classifyGraph({ name: 'Demo' }, true)).toBe('db')
    expect(classifyGraph({ name: 'Demo' }, false)).toBe('file')
  })
})

describe('createGraphGate', () => {
  it('keeps waiting while the graph has not loaded, then decides', async () => {
    const scripted = scriptedProbe()
    const gate = createGraphGate(scripted.probe)
    let decided: string | null = null
    void gate.decided.then((support) => {
      decided = support
    })

    gate.recheck()
    scripted.answer('unknown')
    await flush()
    expect(decided).toBeNull()

    gate.recheck()
    scripted.answer('db')
    await flush()
    expect(decided).toBe('db')
  })

  it('reports a file graph, so the warning still reaches the right user', async () => {
    const scripted = scriptedProbe()
    const gate = createGraphGate(scripted.probe)

    gate.recheck()
    scripted.answer('file')
    await expect(gate.decided).resolves.toBe('file')
  })

  it('never runs two probes at once', async () => {
    const scripted = scriptedProbe()
    const gate = createGraphGate(scripted.probe)

    gate.recheck()
    gate.recheck()
    gate.recheck()
    expect(scripted.state.calls).toBe(1)

    scripted.answer('unknown')
    await flush()
    gate.recheck()
    expect(scripted.state.calls).toBe(2)
  })

  it('stops probing once the answer is decided', async () => {
    const scripted = scriptedProbe()
    const gate = createGraphGate(scripted.probe)

    gate.recheck()
    scripted.answer('db')
    await gate.decided

    gate.recheck()
    expect(scripted.state.calls).toBe(1)
  })

  it('retries after a failed probe instead of deciding on it', async () => {
    const scripted = scriptedProbe()
    const gate = createGraphGate(scripted.probe)
    let decided: string | null = null
    void gate.decided.then((support) => {
      decided = support
    })

    gate.recheck()
    scripted.fail(new Error('bridge not ready'))
    await flush()
    expect(decided).toBeNull()

    gate.recheck()
    scripted.answer('db')
    await flush()
    expect(decided).toBe('db')
    expect(scripted.state.calls).toBe(2)
  })
})
