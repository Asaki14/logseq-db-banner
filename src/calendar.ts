/**
 * Pure month-grid construction. Month length, leap years and the week-start
 * setting all fall out of local calendar arithmetic, so there are no special
 * cases: the padding before the first of the month is the offset of its weekday
 * from the configured first column, and the grid is filled to whole weeks.
 */

import { toJournalDay, type WeekStart } from './progress'

export interface CalendarCell {
  /** Day of the month, or `null` for a padding cell outside it. */
  day: number | null
  /** `YYYYMMDD`, matching Logseq's `journalDay`; `null` on padding cells. */
  journalDay: number | null
  isToday: boolean
  /** Whether that day's journal page already has content. */
  hasContent: boolean
}

export interface CalendarGrid {
  year: number
  /** 1–12. */
  month: number
  /** Weekday initials, first column first. */
  weekdayLabels: string[]
  /** Whole weeks of exactly seven cells. */
  weeks: CalendarCell[][]
}

const WEEKDAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

/** Days in a 1–12 month, leap years included (day 0 of the next month). */
export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

export function buildCalendarGrid(
  now: Date,
  weekStart: WeekStart,
  hasContent: (journalDay: number) => boolean = () => false,
): CalendarGrid {
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  const length = daysInMonth(year, month)
  const leading = (new Date(year, month - 1, 1).getDay() - weekStart + 7) % 7
  const today = toJournalDay(now)

  const weeks: CalendarCell[][] = []
  for (let cell = 0; cell < leading + length; cell += 1) {
    if (cell % 7 === 0) weeks.push([])

    const day = cell - leading + 1
    if (day < 1) {
      weeks[weeks.length - 1].push(paddingCell())
      continue
    }
    const journalDay = year * 10_000 + month * 100 + day
    weeks[weeks.length - 1].push({
      day,
      journalDay,
      isToday: journalDay === today,
      hasContent: hasContent(journalDay),
    })
  }
  // Trailing padding, so every row is a full week and the columns line up.
  const lastWeek = weeks[weeks.length - 1]
  while (lastWeek.length < 7) lastWeek.push(paddingCell())

  return {
    year,
    month,
    weekdayLabels: Array.from(
      { length: 7 },
      (_unused, column) => WEEKDAY_LABELS[(weekStart + column) % 7],
    ),
    weeks,
  }
}

function paddingCell(): CalendarCell {
  return { day: null, journalDay: null, isToday: false, hasContent: false }
}
