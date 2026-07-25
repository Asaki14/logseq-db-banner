/** Pure presentation helpers shared by the widget layer. */

import { clamp01 } from './progress'

/** `0.4237` -> `"42.4%"`. Fractions outside `[0, 1]` are clamped first. */
export function formatPercent(fraction: number, digits = 1): string {
  const safeDigits = Number.isFinite(digits)
    ? Math.min(Math.max(Math.trunc(digits), 0), 4)
    : 1
  return `${(clamp01(fraction) * 100).toFixed(safeDigits)}%`
}

/** Bar width as a CSS percentage string. */
export function formatBarWidth(fraction: number): string {
  return `${(clamp01(fraction) * 100).toFixed(3)}%`
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

/** `2026-07` -> `"July 2026"`. `month` is 1-12, as in `CalendarGrid`. */
export function formatMonthLabel(year: number, month: number): string {
  return `${MONTH_NAMES[month - 1] ?? '?'} ${year}`
}

/** `20260725` -> `"2026-07-25"`, used as a calendar cell's tooltip. */
export function formatIsoDate(journalDay: number): string {
  const year = Math.floor(journalDay / 10_000)
  const month = Math.floor(journalDay / 100) % 100
  const day = journalDay % 100
  return `${year}-${pad2(month)}-${pad2(day)}`
}

function pad2(value: number): string {
  return value < 10 ? `0${value}` : `${value}`
}
