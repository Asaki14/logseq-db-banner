// @vitest-environment jsdom

/**
 * The layout contract behind the mount point. jsdom does no layout, so nothing
 * here measures widths; what it pins down is the structural and CSS-scoping
 * invariant that the live fix depends on:
 *
 *   `#main-content-container` is `display: flex; flex-direction: row` in Logseq
 *   2.0.1, and `.cp__sidebar-main-content` (`flex: 1 1 0%`) is its only child — the
 *   row exists to centre that column. A banner injected as a second child becomes
 *   a flex item beside the column, which then resolves to zero width. So the banner
 *   must land inside the column, and the injected CSS must not touch host elements.
 *
 * The fixture mirrors the structure measured live, right sidebar included: it is
 * `#right-sidebar` under `#app-container`, a sibling of the scroll container rather
 * than a flex item inside it, which is why opening it narrows the column from the
 * outside.
 */

import { beforeEach, describe, expect, it } from 'vitest'
import {
  BANNER_ID,
  ensureBanner,
  HOST_ANCHOR_SELECTOR,
  removeBanner,
  renderWidgets,
  setWidgetActionHandler,
} from './banner'
import { bannerStyles } from './styles'

const HOST_MARKUP = `
  <div id="app-container">
    <div id="main-content-container" class="scrollbar-spacing w-full flex justify-center flex-row">
      <div class="cp__sidebar-main-content">
        <div class="mx-auto pb-24"><div id="journals"></div></div>
      </div>
    </div>
    <div id="right-sidebar" class="cp__right-sidebar h-screen"></div>
  </div>
`

beforeEach(() => {
  document.body.innerHTML = HOST_MARKUP
})

describe('banner mount point', () => {
  it('mounts inside the content column, not as a child of the flex row', () => {
    const banner = ensureBanner(document)
    const column = document.querySelector('.cp__sidebar-main-content')
    const flexRow = document.querySelector('#main-content-container')

    expect(banner).not.toBeNull()
    expect(banner?.parentElement).toBe(column)
    expect(column?.firstElementChild).toBe(banner)
    expect([...(flexRow?.children ?? [])]).not.toContain(banner)
  })

  it('does not mount when the content column is absent', () => {
    document.body.innerHTML = '<div id="main-content-container"></div>'
    expect(ensureBanner(document)).toBeNull()
    expect(document.getElementById(BANNER_ID)).toBeNull()
  })

  it('reuses the existing banner and re-attaches it to the content column', () => {
    const first = ensureBanner(document)
    document.body.append(first as HTMLElement)

    const second = ensureBanner(document)
    expect(second).toBe(first)
    expect(second?.parentElement).toBe(
      document.querySelector('.cp__sidebar-main-content'),
    )
  })

  it('removes the banner from the host document', () => {
    ensureBanner(document)
    removeBanner(document)
    expect(document.getElementById(BANNER_ID)).toBeNull()
  })

  it('anchors below the flex row rather than on it', () => {
    expect(HOST_ANCHOR_SELECTOR).not.toBe('#main-content-container')
    expect(HOST_ANCHOR_SELECTOR.startsWith('#main-content-container ')).toBe(true)
  })
})

describe('injected styles', () => {
  const selectors = [
    ...bannerStyles.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/(^|\})\s*([^{}@]+)\{/g),
  ].map((match) => match[2].trim())

  it('finds the rules it is about to check', () => {
    expect(selectors.length).toBeGreaterThan(5)
  })

  it('scopes every selector to the banner, so banner-less pages are untouched', () => {
    // `provideStyle` is global to the host document; a rule that matched a host
    // container would change pages this plugin never draws on.
    for (const selector of selectors) {
      for (const part of selector.split(',')) {
        expect(part.trim()).toMatch(/^#lsdb-banner\b/)
      }
    }
  })

  it('never restyles the host layout containers', () => {
    expect(bannerStyles).not.toMatch(/#main-content-container|cp__sidebar-main-content/)
  })
})

describe('widget rendering', () => {
  const progressView = (percent: string, width: string) => ({
    id: 'day',
    group: 'panel' as const,
    node: {
      class: 'lsdb-widget lsdb-widget--progress',
      children: [
        { tag: 'span' as const, class: 'lsdb-widget__percent', text: percent },
        { class: 'lsdb-widget__bar', style: { width } },
      ],
    },
  })

  function render(views: Parameters<typeof renderWidgets>[1]) {
    const banner = ensureBanner(document) as HTMLElement
    renderWidgets(banner, views, document)
    return banner.querySelector('.lsdb-banner__widgets') as HTMLElement
  }

  it('materialises a node tree, including data attributes and styles', () => {
    const container = render([
      {
        id: 'calendar',
        group: 'calendar',
        node: {
          class: 'lsdb-widget',
          children: [
            {
              tag: 'button',
              class: 'lsdb-calendar__day',
              text: '25',
              title: '2026-07-25',
              data: { today: 'true', content: 'false' },
              action: { kind: 'openJournalDay', day: 20260725 },
            },
          ],
        },
      },
    ])

    const day = container.querySelector('button') as HTMLButtonElement
    expect(day.type).toBe('button')
    expect(day.textContent).toBe('25')
    expect(day.title).toBe('2026-07-25')
    expect(day.dataset.today).toBe('true')
    expect(day.getAttribute('data-lsdb-action')).toBe(
      '{"kind":"openJournalDay","day":20260725}',
    )
  })

  it('groups widgets into one card per group, in first-seen order', () => {
    const container = render([
      { id: 'calendar', group: 'calendar', node: { class: 'lsdb-widget' } },
      progressView('10.0%', '10.000%'),
      { id: 'quote', group: 'panel', node: { class: 'lsdb-widget--quote' } },
    ])

    const cards = [...container.children] as HTMLElement[]
    expect(cards.map((card) => card.className)).toEqual([
      'lsdb-card lsdb-card--calendar',
      'lsdb-card lsdb-card--panel',
    ])
    expect(cards[0].children).toHaveLength(1)
    expect(cards[1].children).toHaveLength(2)
  })

  it('updates a widget in place instead of re-creating it', () => {
    const container = render([progressView('10.0%', '10.000%')])
    const before = container.querySelector('.lsdb-widget--progress')
    const bar = container.querySelector('.lsdb-widget__bar') as HTMLElement

    renderWidgets(
      container.closest('#lsdb-banner') as HTMLElement,
      [progressView('20.0%', '20.000%')],
      document,
    )

    expect(container.querySelector('.lsdb-widget--progress')).toBe(before)
    expect(container.querySelector('.lsdb-widget__bar')).toBe(bar)
    // jsdom normalises the length, hence `20%` rather than `20.000%`.
    expect(bar.style.width).toBe('20%')
    expect(
      (container.querySelector('.lsdb-widget__percent') as HTMLElement).textContent,
    ).toBe('20.0%')
  })

  it('removes a widget that is no longer rendered', () => {
    const container = render([progressView('10.0%', '10.000%')])
    expect(container.dataset.widgetIds).toBe('day')

    renderWidgets(
      container.closest('#lsdb-banner') as HTMLElement,
      [],
      document,
    )
    expect(container.querySelectorAll('.lsdb-widget')).toHaveLength(0)
    expect(container.dataset.widgetIds).toBe('')
  })

  it('drops a data attribute the new node no longer has', () => {
    const view = (data: Record<string, string>) => ({
      id: 'calendar',
      group: 'calendar' as const,
      node: { class: 'lsdb-widget', data },
    })
    const container = render([view({ today: 'true', content: 'true' })])
    renderWidgets(
      container.closest('#lsdb-banner') as HTMLElement,
      [view({ today: 'true' })],
      document,
    )

    const widget = container.querySelector('.lsdb-widget') as HTMLElement
    expect(widget.dataset.today).toBe('true')
    expect(widget.dataset.content).toBeUndefined()
  })

  it('routes a click on an actionable node to the handler', () => {
    const actions: unknown[] = []
    setWidgetActionHandler((action) => actions.push(action))

    const container = render([
      {
        id: 'calendar',
        group: 'calendar',
        node: {
          class: 'lsdb-widget',
          children: [
            {
              tag: 'button',
              class: 'lsdb-calendar__day',
              text: '25',
              action: { kind: 'openJournalDay', day: 20260725 },
            },
            { tag: 'span', class: 'lsdb-calendar__pad' },
          ],
        },
      },
    ])

    ;(container.querySelector('button') as HTMLElement).click()
    ;(container.querySelector('.lsdb-calendar__pad') as HTMLElement).click()
    ;(container as HTMLElement).click()

    expect(actions).toEqual([{ kind: 'openJournalDay', day: 20260725 }])
  })
})

/**
 * Regression cover for the intermittent "clicking a date does nothing".
 *
 * Reproduced live: pressing the mouse on a calendar day while the widget DOM was
 * rebuilt — which the old renderer did whenever the *set* of rendered widgets
 * changed, and the quote widget dropped out of that set on every cache
 * invalidation — detached the pressed button before mouseup. Chrome then fires no
 * `click` event at all, so the delegated handler never runs and nothing
 * navigates. Keeping the element identity of widgets that stay is the fix.
 */
describe('a widget appearing or disappearing', () => {
  const calendarView = {
    id: 'calendar',
    group: 'calendar' as const,
    node: {
      class: 'lsdb-widget',
      children: [
        {
          tag: 'button' as const,
          class: 'lsdb-calendar__day',
          text: '25',
          action: { kind: 'openJournalDay' as const, day: 20260725 },
        },
      ],
    },
  }
  const dayView = {
    id: 'day',
    group: 'panel' as const,
    node: { class: 'lsdb-widget lsdb-widget--progress', text: '52%' },
  }
  const quoteView = {
    id: 'quote',
    group: 'panel' as const,
    node: { class: 'lsdb-widget lsdb-widget--quote', text: 'Amor fati.' },
  }

  function render(views: Parameters<typeof renderWidgets>[1]) {
    const banner = ensureBanner(document) as HTMLElement
    renderWidgets(banner, views, document)
    return banner
  }

  it('leaves the other widgets, and their nodes, exactly where they were', () => {
    const banner = render([calendarView, dayView, quoteView])
    const day = banner.querySelector('.lsdb-calendar__day')
    const progress = banner.querySelector('.lsdb-widget--progress')
    const cards = [...(banner.querySelector('.lsdb-banner__widgets')?.children ?? [])]

    // The quote drops out (its data was invalidated) and comes back.
    renderWidgets(banner, [calendarView, dayView], document)
    expect(banner.querySelector('.lsdb-calendar__day')).toBe(day)
    expect(banner.querySelector('.lsdb-widget--progress')).toBe(progress)
    expect(banner.querySelector('.lsdb-widget--quote')).toBeNull()

    renderWidgets(banner, [calendarView, dayView, quoteView], document)
    expect(banner.querySelector('.lsdb-calendar__day')).toBe(day)
    expect(banner.querySelector('.lsdb-widget--progress')).toBe(progress)
    expect(banner.querySelector('.lsdb-widget--quote')).not.toBeNull()
    expect([...(banner.querySelector('.lsdb-banner__widgets')?.children ?? [])]).toEqual(
      cards,
    )
  })

  it('still routes a click on a day the re-render kept', () => {
    const actions: unknown[] = []
    setWidgetActionHandler((action) => actions.push(action))

    const banner = render([calendarView, dayView, quoteView])
    renderWidgets(banner, [calendarView, dayView], document)
    renderWidgets(banner, [calendarView, dayView, quoteView], document)
    ;(banner.querySelector('.lsdb-calendar__day') as HTMLElement).click()

    expect(actions).toEqual([{ kind: 'openJournalDay', day: 20260725 }])
  })

  it('keeps the widget order when one comes back in the middle', () => {
    const banner = render([calendarView, quoteView, dayView])
    renderWidgets(banner, [calendarView, dayView], document)
    renderWidgets(banner, [calendarView, quoteView, dayView], document)

    const panel = banner.querySelector('.lsdb-card--panel') as HTMLElement
    expect([...panel.children].map((child) => child.className)).toEqual([
      'lsdb-widget lsdb-widget--quote',
      'lsdb-widget lsdb-widget--progress',
    ])
  })
})

describe('a banner left behind by a previous plugin instance', () => {
  it('gets our click listener, since the old instance took its own away', () => {
    // What survives a reload: the element, without a live listener on it.
    const orphan = document.createElement('div')
    orphan.id = BANNER_ID
    const widgets = document.createElement('div')
    widgets.className = 'lsdb-banner__widgets'
    orphan.append(widgets)
    document.querySelector('.cp__sidebar-main-content')?.prepend(orphan)

    const actions: unknown[] = []
    setWidgetActionHandler((action) => actions.push(action))

    const banner = ensureBanner(document) as HTMLElement
    expect(banner).toBe(orphan)
    renderWidgets(
      banner,
      [
        {
          id: 'calendar',
          group: 'calendar',
          node: {
            tag: 'button',
            class: 'lsdb-calendar__day',
            text: '25',
            action: { kind: 'openJournalDay', day: 20260725 },
          },
        },
      ],
      document,
    )
    ;(banner.querySelector('button') as HTMLElement).click()

    expect(actions).toEqual([{ kind: 'openJournalDay', day: 20260725 }])
  })
})
