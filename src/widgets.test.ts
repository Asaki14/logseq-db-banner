import { describe, expect, it, vi } from 'vitest'
import type { WidgetNode } from './view'
import {
  buildWidgetViews,
  widgetDataRequests,
  widgetDefinitions,
  type WidgetContext,
  type WidgetHost,
} from './widgets'

const widgetIds = widgetDefinitions.map(({ id }) => id)

const context: WidgetContext = {
  now: new Date(2025, 6, 25, 12, 0), // Friday noon
  weekStart: 1,
  birthDate: new Date(1990, 0, 1),
  lifespanYears: 85,
  quoteTag: 'quotes',
  // The real pick is anchored to the user's arrival on a journal view; the widget
  // only has to render whatever it is handed. See `rotation.test.ts`.
  quoteForVisit: (quotes) => quotes[0] ?? null,
}

const allVisible = () => true

/** Depth-first text of a node tree, so assertions read like the rendered widget. */
function texts(node: WidgetNode): string[] {
  if (!node.children) return node.text === undefined ? [] : [node.text]
  return node.children.flatMap(texts)
}

function nodeById(views: { id: string; node: WidgetNode }[], id: string) {
  const view = views.find((candidate) => candidate.id === id)
  if (!view) throw new Error(`no ${id} widget was rendered`)
  return view.node
}

function find(
  node: WidgetNode,
  predicate: (candidate: WidgetNode) => boolean,
): WidgetNode | null {
  if (predicate(node)) return node
  for (const child of node.children ?? []) {
    const hit = find(child, predicate)
    if (hit) return hit
  }
  return null
}

function collect(
  node: WidgetNode,
  predicate: (candidate: WidgetNode) => boolean,
): WidgetNode[] {
  const found = predicate(node) ? [node] : []
  for (const child of node.children ?? []) found.push(...collect(child, predicate))
  return found
}

describe('widget registry', () => {
  it('lists the calendar, the four progress widgets and the quote', () => {
    expect(widgetIds).toEqual(['calendar', 'day', 'week', 'year', 'life', 'quote'])
  })

  it('puts the calendar on its own card and everything else on the panel', () => {
    const groups = buildWidgetViews(context, allVisible).map((view) => [
      view.id,
      view.group,
    ])
    expect(groups).toEqual([
      ['calendar', 'calendar'],
      ['day', 'panel'],
      ['week', 'panel'],
      ['year', 'panel'],
      ['life', 'panel'],
    ])
  })

  it('gives every widget a unique id', () => {
    expect(new Set(widgetIds).size).toBe(widgetDefinitions.length)
  })

  it('keeps the time-progress widgets free of host data', () => {
    for (const id of ['day', 'week', 'year', 'life']) {
      const definition = widgetDefinitions.find((candidate) => candidate.id === id)
      expect(definition?.request?.(context) ?? null).toBeNull()
    }
  })
})

describe('progress widgets', () => {
  it('renders a label, a three-decimal percentage and a bar width', () => {
    const day = nodeById(buildWidgetViews(context, allVisible), 'day')
    // No remaining-time line: the hint slot stays empty while there is a value.
    expect(texts(day)).toEqual(['Day', '', '50.000%'])

    const bar = find(day, (node) => node.class === 'lsdb-widget__bar')
    expect(bar?.style).toEqual({ width: '50.000%' })
  })

  it('keeps the head row a constant shape so it is patched, not rebuilt', () => {
    const withValue = nodeById(buildWidgetViews(context, allVisible), 'life')
    const without = nodeById(
      buildWidgetViews({ ...context, birthDate: null }, allVisible),
      'life',
    )
    const head = (node: WidgetNode) =>
      find(node, (candidate) => candidate.class === 'lsdb-widget__head')
    expect(head(withValue)?.children?.map((child) => child.class)).toEqual(
      head(without)?.children?.map((child) => child.class),
    )
  })

  it('honours the visibility predicate and keeps registry order', () => {
    const views = buildWidgetViews(context, (id) => id === 'year' || id === 'day')
    expect(views.map((view) => view.id)).toEqual(['day', 'year'])
  })

  it('returns nothing when every widget is hidden', () => {
    expect(buildWidgetViews(context, () => false)).toEqual([])
  })

  it('uses the configured week start', () => {
    const week = (weekStart: 0 | 1) =>
      texts(nodeById(buildWidgetViews({ ...context, weekStart }, allVisible), 'week'))
    // Friday noon is 4.5 of 7 days into a Monday week, 5.5 into a Sunday one.
    expect(week(1)).toEqual(['Week', '', '64.286%'])
    expect(week(0)).toEqual(['Week', '', '78.571%'])
  })

  it('marks the life widget unavailable without a birth date', () => {
    const life = nodeById(
      buildWidgetViews({ ...context, birthDate: null }, allVisible),
      'life',
    )
    expect(texts(life)).toEqual(['Life', 'set a birth date', '--%'])
    expect(find(life, (node) => node.class === 'lsdb-widget__bar')?.style).toEqual({
      width: '0%',
    })
  })

  it('reports life progress to three decimals', () => {
    const life = nodeById(buildWidgetViews(context, allVisible), 'life')
    expect(texts(life)).toEqual(['Life', '', '41.840%'])
  })

  it('caps an exceeded lifespan at 100%', () => {
    const life = nodeById(
      buildWidgetViews({ ...context, birthDate: new Date(1900, 0, 1) }, allVisible),
      'life',
    )
    expect(texts(life)).toEqual(['Life', '', '100.000%'])
  })

  it('is 100% on the last day of a leap-year lifespan boundary', () => {
    // Born 29 February 2000 with an 85 year lifespan ends 1 March 2085.
    const life = nodeById(
      buildWidgetViews(
        { ...context, now: new Date(2085, 2, 1), birthDate: new Date(2000, 1, 29) },
        allVisible,
      ),
      'life',
    )
    expect(texts(life)).toContain('100.000%')
  })
})

describe('calendar widget', () => {
  const calendarNode = (data: unknown, overrides: Partial<WidgetContext> = {}) =>
    nodeById(
      buildWidgetViews({ ...context, ...overrides }, allVisible, () => data),
      'calendar',
    )

  it('asks the host for the visible month only', () => {
    const requests = widgetDataRequests(context, allVisible)
    const calendar = requests.find((entry) => entry.id === 'calendar')
    expect(calendar?.request.key).toBe('journal-content:2025-7')

    const host = {
      journalDaysWithContent: vi.fn(() => Promise.resolve([])),
      taggedTexts: vi.fn(() => Promise.resolve([])),
    } satisfies WidgetHost
    void calendar?.request.load(host)
    expect(host.journalDaysWithContent).toHaveBeenCalledWith(20250701, 20250731)
  })

  it('re-keys its data when the month changes, but not on a new day', () => {
    const keyAt = (now: Date) =>
      widgetDataRequests({ ...context, now }, allVisible).find(
        (entry) => entry.id === 'calendar',
      )?.request.key
    expect(keyAt(new Date(2025, 6, 26))).toBe(keyAt(context.now))
    expect(keyAt(new Date(2025, 7, 1))).not.toBe(keyAt(context.now))
  })

  it('titles itself with the month and renders weekday headers first', () => {
    const node = calendarNode([])
    expect(texts(node)[0]).toBe('July 2025')
    expect(
      collect(node, (candidate) => candidate.class === 'lsdb-calendar__weekday').map(
        (candidate) => candidate.text,
      ),
    ).toEqual(['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'])
  })

  it('gives every day an open action for its own journal day', () => {
    const days = collect(
      calendarNode([]),
      (candidate) => candidate.class === 'lsdb-calendar__day',
    )
    expect(days).toHaveLength(31)
    expect(days[0].action).toEqual({ kind: 'openJournalDay', day: 20250701 })
    expect(days[30].action).toEqual({ kind: 'openJournalDay', day: 20250731 })
    // A date with no journal page is still clickable.
    expect(days.every((day) => day.action !== undefined)).toBe(true)
  })

  it('marks only the days the host reported, and today', () => {
    const node = calendarNode([20250703, 20250725])
    const marked = collect(
      node,
      (candidate) => candidate.data?.content === 'true',
    ).map((candidate) => candidate.text)
    expect(marked).toEqual(['3', '25'])

    const today = collect(node, (candidate) => candidate.data?.today === 'true')
    expect(today.map((candidate) => candidate.text)).toEqual(['25'])
  })

  it('renders an unmarked month while the data is still loading or broken', () => {
    for (const data of [undefined, null, 'nonsense', { days: [1] }]) {
      const node = calendarNode(data)
      expect(
        collect(node, (candidate) => candidate.data?.content === 'true'),
      ).toEqual([])
      expect(
        collect(node, (candidate) => candidate.class === 'lsdb-calendar__day'),
      ).toHaveLength(31)
    }
  })

  it('tolerates day numbers that arrive as strings', () => {
    const node = calendarNode(['20250703', 'nope', null])
    expect(
      collect(node, (candidate) => candidate.data?.content === 'true').map(
        (candidate) => candidate.text,
      ),
    ).toEqual(['3'])
  })
})

describe('quote widget', () => {
  const quoteNode = (data: unknown, overrides: Partial<WidgetContext> = {}) =>
    buildWidgetViews({ ...context, ...overrides }, allVisible, () => data).find(
      (view) => view.id === 'quote',
    )?.node

  it('asks the host for the configured tag', () => {
    const request = widgetDataRequests(context, allVisible).find(
      (entry) => entry.id === 'quote',
    )?.request
    expect(request?.key).toBe('tagged-texts:quotes')

    const host = {
      journalDaysWithContent: vi.fn(() => Promise.resolve([])),
      taggedTexts: vi.fn(() => Promise.resolve([])),
    } satisfies WidgetHost
    void request?.load(host)
    expect(host.taggedTexts).toHaveBeenCalledWith('quotes')
  })

  it('asks for nothing when the tag setting is empty', () => {
    expect(
      widgetDataRequests({ ...context, quoteTag: '' }, allVisible).map(
        (entry) => entry.id,
      ),
    ).toEqual(['calendar'])
  })

  it('renders one of the collected quotes', () => {
    const node = quoteNode(['first quote', 'second quote'])
    expect(texts(node as WidgetNode)).toHaveLength(1)
    expect(['first quote', 'second quote']).toContain(texts(node as WidgetNode)[0])
  })

  it('renders the collected candidates through the visit\'s pick', () => {
    const quoteForVisit = vi.fn(() => 'whatever the visit chose')
    const node = quoteNode(['  bravo ', 'bravo', '- alpha'], { quoteForVisit })
    // Normalised, de-duplicated and ordered before the pick sees them.
    expect(quoteForVisit).toHaveBeenCalledWith(['alpha', 'bravo'])
    expect(texts(node as WidgetNode)).toEqual(['whatever the visit chose'])
  })

  it('shows nothing when the visit picked nothing', () => {
    expect(quoteNode(['alpha'], { quoteForVisit: () => null })).toBeUndefined()
  })

  it('stays out of the banner when the source is empty, missing or broken', () => {
    for (const data of [undefined, null, [], ['', '  '], 'nonsense']) {
      expect(quoteNode(data)).toBeUndefined()
    }
  })

  it('bounds a very long quote', () => {
    const node = quoteNode(['word '.repeat(400)])
    const rendered = texts(node as WidgetNode)[0]
    expect(rendered.length).toBeLessThan(260)
    expect(rendered.endsWith('…')).toBe(true)
  })
})
