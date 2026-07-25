/**
 * The widget layer. Each widget is a pure descriptor: an id, a label and a
 * `compute` that turns the banner context into a fraction plus a short detail
 * line. Adding a widget means appending one descriptor here (and one visibility
 * setting) — the banner renderer iterates whatever this module exposes.
 */

import { formatBarWidth, formatPercent } from './format'
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

export interface WidgetContext {
  now: Date
  weekStart: WeekStart
  birthDate: Date | null
  lifespanYears: number
}

export interface WidgetComputed {
  fraction: number
  detail: string
}

export interface WidgetDefinition {
  id: string
  label: string
  /** `null` when the widget lacks the settings it needs to say anything. */
  compute(context: WidgetContext): WidgetComputed | null
  /** Shown in place of a value when `compute` returns `null`. */
  unavailableHint: string
}

export interface WidgetView {
  id: string
  label: string
  fraction: number | null
  percentText: string
  barWidth: string
  detail: string
}

function hoursRemaining(now: Date): number {
  const remaining = dayBounds(now).end.getTime() - now.getTime()
  return Math.max(0, Math.ceil(remaining / 3_600_000))
}

export const widgetDefinitions: WidgetDefinition[] = [
  {
    id: 'day',
    label: 'Day',
    unavailableHint: '—',
    compute: ({ now }) => ({
      fraction: dayProgress(now),
      detail: `${hoursRemaining(now)}h left`,
    }),
  },
  {
    id: 'week',
    label: 'Week',
    unavailableHint: '—',
    compute: ({ now, weekStart }) => ({
      fraction: weekProgress(now, weekStart),
      detail: `${daysRemaining(now, weekBounds(now, weekStart))}d left`,
    }),
  },
  {
    id: 'year',
    label: 'Year',
    unavailableHint: '—',
    compute: ({ now }) => ({
      fraction: yearProgress(now),
      detail: `${daysRemaining(now, yearBounds(now))}d left`,
    }),
  },
  {
    id: 'life',
    label: 'Life',
    unavailableHint: 'set a birth date',
    compute: ({ now, birthDate, lifespanYears }) => {
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
  },
]

export function buildWidgetViews(
  context: WidgetContext,
  isVisible: (id: string) => boolean,
): WidgetView[] {
  const views: WidgetView[] = []

  for (const definition of widgetDefinitions) {
    if (!isVisible(definition.id)) continue

    const computed = definition.compute(context)
    views.push({
      id: definition.id,
      label: definition.label,
      fraction: computed?.fraction ?? null,
      percentText: computed ? formatPercent(computed.fraction) : '--%',
      barWidth: computed ? formatBarWidth(computed.fraction) : '0%',
      detail: computed?.detail ?? definition.unavailableHint,
    })
  }

  return views
}
