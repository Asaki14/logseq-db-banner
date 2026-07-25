/**
 * The widget layer. Each widget is a descriptor with two halves:
 *
 * - `request` names the host data it needs — a cache key, a TTL and a loader
 *   that talks to the `WidgetHost`. The runtime caches per widget id, so a
 *   widget backed by a graph query is not re-queried on the per-second tick.
 * - `build` turns the context plus that (possibly absent) data into a `WidgetNode`
 *   tree, and is pure. `null` means "nothing to show", and the widget is skipped.
 *
 * Adding a widget means appending one descriptor here plus a visibility setting;
 * neither `banner.ts` nor the renderer learns anything about it.
 */

import { buildCalendarGrid } from './calendar'
import {
  formatBarWidth,
  formatIsoDate,
  formatMonthLabel,
  formatPercent,
} from './format'
import {
  dayBounds,
  daysRemaining,
  dayProgress,
  lifeBounds,
  lifeProgress,
  weekBounds,
  weekProgress,
  yearBounds,
  yearProgress,
  type WeekStart,
} from './progress'
import { collectQuotes, pickQuoteForDate } from './quote'
import type { WidgetNode } from './view'

export interface WidgetContext {
  now: Date
  weekStart: WeekStart
  birthDate: Date | null
  lifespanYears: number
  /** Tag whose pages hold the quotes. */
  quoteTag: string
}

/** The graph reads a widget may ask for. Implemented in `host.ts`. */
export interface WidgetHost {
  /**
   * `YYYYMMDD` days within `[from, to]` whose journal page has at least one
   * non-empty block.
   */
  journalDaysWithContent(from: number, to: number): Promise<number[]>
  /** Top-level block texts of every page carrying `tag`. */
  taggedPageTexts(tag: string): Promise<string[]>
}

export interface WidgetDataRequest {
  /** Identity of the data; a new key retires the cached value. */
  key: string
  /** How long a loaded value stays fresh. */
  ttlMs: number
  load(host: WidgetHost): Promise<unknown>
}

export interface WidgetDefinition {
  id: string
  label: string
  /** Host data needed right now, or `null`/absent when the widget needs none. */
  request?(context: WidgetContext): WidgetDataRequest | null
  /** `null` when the widget has nothing to show and should not be rendered. */
  build(context: WidgetContext, data: unknown): WidgetNode | null
}

export interface WidgetView {
  id: string
  node: WidgetNode
}

interface WidgetComputed {
  fraction: number
  detail: string
}

/** Journal marks stay usable for a minute; a day's edits show up soon after. */
const CALENDAR_TTL_MS = 60_000
/** The quote list changes rarely, and the pick is date-derived anyway. */
const QUOTE_TTL_MS = 300_000

function hoursRemaining(now: Date): number {
  const remaining = dayBounds(now).end.getTime() - now.getTime()
  return Math.max(0, Math.ceil(remaining / 3_600_000))
}

/**
 * A time-progress widget: a label, a percentage, a bar and a detail line.
 * `compute` returns `null` when the settings it needs are missing, and the
 * widget then shows `unavailableHint` instead of a value.
 */
function progressWidget(
  id: string,
  label: string,
  unavailableHint: string,
  compute: (context: WidgetContext) => WidgetComputed | null,
): WidgetDefinition {
  return {
    id,
    label,
    build(context) {
      const computed = compute(context)
      return {
        class: 'lsdb-widget lsdb-widget--progress',
        data: { widget: id },
        children: [
          {
            class: 'lsdb-widget__head',
            children: [
              { tag: 'span', class: 'lsdb-widget__label', text: label },
              {
                tag: 'span',
                class: 'lsdb-widget__percent',
                text: computed ? formatPercent(computed.fraction) : '--%',
              },
            ],
          },
          {
            class: 'lsdb-widget__track',
            children: [
              {
                class: 'lsdb-widget__bar',
                style: {
                  width: computed ? formatBarWidth(computed.fraction) : '0%',
                },
              },
            ],
          },
          {
            class: 'lsdb-widget__detail',
            text: computed?.detail ?? unavailableHint,
          },
        ],
      }
    },
  }
}

/** Days handed back by the host, narrowed to the `YYYYMMDD` integers we asked for. */
function readJournalDays(data: unknown): Set<number> {
  const days = new Set<number>()
  if (!Array.isArray(data)) return days
  for (const value of data) {
    const day = typeof value === 'string' ? Number(value) : value
    if (typeof day === 'number' && Number.isInteger(day) && day > 0) {
      days.add(day)
    }
  }
  return days
}

const calendarWidget: WidgetDefinition = {
  id: 'calendar',
  label: 'Calendar',
  request({ now }) {
    const year = now.getFullYear()
    const month = now.getMonth() + 1
    const firstOfMonth = year * 10_000 + month * 100
    return {
      key: `journal-content:${year}-${month}`,
      ttlMs: CALENDAR_TTL_MS,
      // The range is the widest a month can be; shorter months simply have no
      // journal days past their end.
      load: (host) =>
        host.journalDaysWithContent(firstOfMonth + 1, firstOfMonth + 31),
    }
  },
  build({ now, weekStart }, data) {
    const days = readJournalDays(data)
    const grid = buildCalendarGrid(now, weekStart, (day) => days.has(day))

    const cells: WidgetNode[] = grid.weekdayLabels.map((label) => ({
      tag: 'span',
      class: 'lsdb-calendar__weekday',
      text: label,
    }))
    for (const week of grid.weeks) {
      for (const cell of week) {
        if (cell.journalDay === null) {
          cells.push({ tag: 'span', class: 'lsdb-calendar__pad' })
          continue
        }
        cells.push({
          tag: 'button',
          class: 'lsdb-calendar__day',
          text: String(cell.day),
          title: formatIsoDate(cell.journalDay),
          data: {
            today: cell.isToday ? 'true' : 'false',
            content: cell.hasContent ? 'true' : 'false',
          },
          action: { kind: 'openJournalDay', day: cell.journalDay },
        })
      }
    }

    return {
      class: 'lsdb-widget lsdb-widget--calendar',
      data: { widget: 'calendar' },
      children: [
        {
          class: 'lsdb-widget__head',
          children: [
            {
              tag: 'span',
              class: 'lsdb-widget__label',
              text: formatMonthLabel(grid.year, grid.month),
            },
          ],
        },
        { class: 'lsdb-calendar', children: cells },
      ],
    }
  },
}

const quoteWidget: WidgetDefinition = {
  id: 'quote',
  label: 'Quote',
  request({ quoteTag }) {
    if (!quoteTag) return null
    return {
      key: `tagged-texts:${quoteTag}`,
      ttlMs: QUOTE_TTL_MS,
      load: (host) => host.taggedPageTexts(quoteTag),
    }
  },
  build({ now }, data) {
    // No tagged page, no top-level blocks, or a query that failed: stay silent.
    if (!Array.isArray(data)) return null
    const quote = pickQuoteForDate(collectQuotes(data), now)
    if (!quote) return null

    return {
      class: 'lsdb-widget lsdb-widget--quote',
      data: { widget: 'quote' },
      children: [
        { class: 'lsdb-quote__text', text: quote, title: quote },
      ],
    }
  },
}

export const widgetDefinitions: WidgetDefinition[] = [
  progressWidget('day', 'Day', '—', ({ now }) => ({
    fraction: dayProgress(now),
    detail: `${hoursRemaining(now)}h left`,
  })),
  progressWidget('week', 'Week', '—', ({ now, weekStart }) => ({
    fraction: weekProgress(now, weekStart),
    detail: `${daysRemaining(now, weekBounds(now, weekStart))}d left`,
  })),
  progressWidget('year', 'Year', '—', ({ now }) => ({
    fraction: yearProgress(now),
    detail: `${daysRemaining(now, yearBounds(now))}d left`,
  })),
  progressWidget(
    'life',
    'Life',
    'set a birth date',
    ({ now, birthDate, lifespanYears }) => {
      const fraction = lifeProgress(now, birthDate, lifespanYears)
      if (fraction === null || !birthDate) return null

      const { end } = lifeBounds(birthDate, lifespanYears)
      const remainingDays = daysRemaining(now, { start: now, end })
      const detail =
        remainingDays === 0
          ? `${lifespanYears}y reached`
          : `${(remainingDays / 365.25).toFixed(1)}y left`
      return { fraction, detail }
    },
  ),
  calendarWidget,
  quoteWidget,
]

/** The data request of every visible widget that has one, in registry order. */
export function widgetDataRequests(
  context: WidgetContext,
  isVisible: (id: string) => boolean,
): { id: string; request: WidgetDataRequest }[] {
  const requests: { id: string; request: WidgetDataRequest }[] = []
  for (const definition of widgetDefinitions) {
    if (!isVisible(definition.id)) continue
    const request = definition.request?.(context)
    if (request) requests.push({ id: definition.id, request })
  }
  return requests
}

export function buildWidgetViews(
  context: WidgetContext,
  isVisible: (id: string) => boolean,
  dataFor: (id: string) => unknown = () => undefined,
): WidgetView[] {
  const views: WidgetView[] = []
  for (const definition of widgetDefinitions) {
    if (!isVisible(definition.id)) continue
    const node = definition.build(context, dataFor(definition.id))
    if (node) views.push({ id: definition.id, node })
  }
  return views
}
