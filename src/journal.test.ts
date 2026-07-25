import { describe, expect, it } from 'vitest'
import { shouldMountBanner, toHostView } from './journal'

/**
 * The raw values below are the shapes observed at runtime in Logseq 2.0.1 on a
 * DB graph, via `getStateFromStore(['route-match', 'data', 'name'])` and
 * `getCurrentPage()`.
 */
const routeMatch = (name: string) => name

const journalPage = {
  name: 'jul 25th, 2026',
  title: 'Jul 25th, 2026',
  journalDay: 20260725,
  uuid: '00000001-2026-0725-0000-000000000000',
}

const normalPage = {
  name: 'contents',
  title: 'Contents',
  uuid: '00000004-1690-2597-3200-000000000000',
}

const mounts = (rawRoute: unknown, rawPage: unknown) =>
  shouldMountBanner(toHostView(rawRoute, rawPage))

describe('shouldMountBanner on journal views', () => {
  it('mounts on the journals home feed, where no page is current', () => {
    expect(mounts(routeMatch('home'), null)).toBe(true)
  })

  it('mounts on the all-journals feed', () => {
    expect(mounts(routeMatch('allJournals'), null)).toBe(true)
  })

  it('mounts on a single journal page', () => {
    expect(mounts(routeMatch('page'), journalPage)).toBe(true)
  })

  it('mounts when the journal day arrives as a string', () => {
    expect(mounts(routeMatch('page'), { journalDay: '20260725' })).toBe(true)
  })

  it('mounts on a journal page reported with the kebab-case key', () => {
    expect(mounts(routeMatch('page'), { 'journal-day': 20260725 })).toBe(true)
  })
})

describe('shouldMountBanner on everything else', () => {
  it('stays off a normal page', () => {
    expect(mounts(routeMatch('page'), normalPage)).toBe(false)
  })

  it.each(['allPages', 'search', 'settings', 'graph', 'plugins', 'whiteboard', 'file'])(
    'stays off the %s route',
    (name) => {
      expect(mounts(routeMatch(name), null)).toBe(false)
    },
  )

  it('stays off a whiteboard opened as a page without a journal day', () => {
    expect(mounts(routeMatch('page'), { name: 'my board' })).toBe(false)
  })

  it('stays off an unmatched route', () => {
    expect(mounts(null, null)).toBe(false)
  })

  it('stays off the journals route when a custom home page is configured', () => {
    expect(mounts(routeMatch('home'), normalPage)).toBe(false)
  })

  it('rejects a journal day that is not a positive integer', () => {
    for (const journalDay of [0, -20260725, 20260725.5, Number.NaN, 'today', null]) {
      expect(mounts(routeMatch('page'), { journalDay })).toBe(false)
    }
  })
})

describe('toHostView', () => {
  it('keeps the route name the host reported', () => {
    expect(toHostView('allPages', null).routeName).toBe('allPages')
  })

  it('treats a missing or malformed route as no route', () => {
    for (const raw of [null, undefined, '', 42, {}, { data: { name: 'home' } }]) {
      expect(toHostView(raw, null).routeName).toBeNull()
    }
  })

  it('reads the journal day of the current page', () => {
    expect(toHostView(routeMatch('page'), journalPage).page).toEqual({
      journalDay: 20260725,
    })
  })

  it('reports a non-journal page as a page without a journal day', () => {
    expect(toHostView(routeMatch('page'), normalPage).page).toEqual({
      journalDay: null,
    })
  })

  it('reports no page when the host returns none', () => {
    expect(toHostView(routeMatch('home'), null).page).toBeNull()
  })
})
