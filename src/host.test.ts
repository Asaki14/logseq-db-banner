import { afterEach, describe, expect, it } from 'vitest'
import { openJournalDay } from './host'

/**
 * `openJournalDay` is the one part of the host adapter with a decision in it, so
 * it is exercised against a stand-in for the plugin API. The shapes the stand-in
 * returns are the ones Logseq 2.0.1 was observed to return, in particular
 * `createJournalPage` answering `null` for an existing empty journal page.
 */
interface Recorder {
  createdWith: unknown[]
  queries: string[]
  pushed: unknown[]
}

function installHost(options: {
  created?: unknown
  rows?: unknown
}): Recorder {
  const recorder: Recorder = { createdWith: [], queries: [], pushed: [] }
  ;(globalThis as unknown as { logseq: unknown }).logseq = {
    Editor: {
      createJournalPage: async (value: unknown) => {
        recorder.createdWith.push(value)
        return options.created ?? null
      },
    },
    DB: {
      datascriptQuery: async (query: string) => {
        recorder.queries.push(query)
        return options.rows ?? []
      },
    },
    App: {
      pushState: (route: string, payload: unknown) => {
        recorder.pushed.push([route, payload])
      },
    },
  }
  return recorder
}

afterEach(() => {
  delete (globalThis as unknown as { logseq?: unknown }).logseq
})

describe('openJournalDay', () => {
  it('navigates using the page the create call names', async () => {
    const host = installHost({ created: { name: 'jul 14th, 2026' } })

    await openJournalDay(20260714)

    expect(host.pushed).toEqual([['page', { name: 'jul 14th, 2026' }]])
    // Nothing to look up: the create call already identified the day.
    expect(host.queries).toEqual([])
  })

  it('passes epoch milliseconds, not a Date or a journal day', async () => {
    const host = installHost({ created: { name: 'jul 14th, 2026' } })

    await openJournalDay(20260714)

    expect(host.createdWith).toEqual([new Date(2026, 6, 14).getTime()])
  })

  it('still navigates when the day already has an empty page', async () => {
    // The regression: `createJournalPage` answers `null` for a journal page that
    // exists and holds no blocks, which is every day nobody has written on.
    const host = installHost({
      created: null,
      rows: ['00000001-2026-0712-0000-000000000000'],
    })

    await openJournalDay(20260712)

    expect(host.queries[0]).toContain(':block/journal-day 20260712')
    expect(host.pushed).toEqual([
      ['page', { name: '00000001-2026-0712-0000-000000000000' }],
    ])
  })

  it('navigates nowhere when the day has no page at all', async () => {
    const host = installHost({ created: null, rows: [] })

    await openJournalDay(20260712)

    expect(host.pushed).toEqual([])
  })

  it('ignores a day that is not a calendar date', async () => {
    const host = installHost({ created: { name: 'nope' } })

    await openJournalDay(20261332)

    expect(host.createdWith).toEqual([])
    expect(host.pushed).toEqual([])
  })
})
