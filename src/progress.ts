/**
 * Pure date and progress math. Every boundary is computed from local calendar
 * components rather than fixed millisecond offsets, so DST transitions, leap
 * days and leap years fall out of the calendar arithmetic instead of needing
 * special cases.
 */

/** Days of the week as accepted by `weekStart`, `0` = Sunday. */
export type WeekStart = 0 | 1 | 2 | 3 | 4 | 5 | 6

export interface Span {
  start: Date
  end: Date
}

export function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0
  if (value < 0) return 0
  if (value > 1) return 1
  return value
}

/** Local midnight of the day `date` falls on, shifted by `dayOffset` days. */
export function startOfLocalDay(date: Date, dayOffset = 0): Date {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate() + dayOffset,
  )
}

/**
 * A local date as the `YYYYMMDD` integer Logseq stores on journal pages
 * (`journalDay`), which is also a convenient day-stable seed.
 */
export function toJournalDay(date: Date): number {
  return (
    date.getFullYear() * 10_000 +
    (date.getMonth() + 1) * 100 +
    date.getDate()
  )
}

/** Local midnight of a `YYYYMMDD` integer, or `null` when it is not one. */
export function fromJournalDay(day: number): Date | null {
  if (!Number.isInteger(day) || day < 10_000_101) return null

  const year = Math.floor(day / 10_000)
  const month = Math.floor(day / 100) % 100
  const dayOfMonth = day % 100
  if (month < 1 || month > 12 || dayOfMonth < 1 || dayOfMonth > 31) return null

  const date = new Date(year, month - 1, dayOfMonth)
  return toJournalDay(date) === day ? date : null
}

export function dayBounds(now: Date): Span {
  return { start: startOfLocalDay(now), end: startOfLocalDay(now, 1) }
}

export function weekBounds(now: Date, weekStart: WeekStart): Span {
  const daysSinceStart = (now.getDay() - weekStart + 7) % 7
  const start = startOfLocalDay(now, -daysSinceStart)
  return { start, end: startOfLocalDay(start, 7) }
}

export function yearBounds(now: Date): Span {
  return {
    start: new Date(now.getFullYear(), 0, 1),
    end: new Date(now.getFullYear() + 1, 0, 1),
  }
}

/**
 * The lifespan window. `lifespanYears` is added as calendar years, so the end
 * date keeps the birthday's month and day. A 29 February birth date rolls into
 * 1 March when the target year is not a leap year, which is what `Date` does
 * for any overflowing day-of-month.
 */
export function lifeBounds(birthDate: Date, lifespanYears: number): Span {
  const start = startOfLocalDay(birthDate)
  return {
    start,
    end: new Date(
      start.getFullYear() + lifespanYears,
      start.getMonth(),
      start.getDate(),
    ),
  }
}

/** Elapsed fraction of `span` at `now`, clamped into `[0, 1]`. */
export function spanProgress(now: Date, span: Span): number {
  const total = span.end.getTime() - span.start.getTime()
  if (!(total > 0)) return 0
  return clamp01((now.getTime() - span.start.getTime()) / total)
}

export function dayProgress(now: Date): number {
  return spanProgress(now, dayBounds(now))
}

export function weekProgress(now: Date, weekStart: WeekStart): number {
  return spanProgress(now, weekBounds(now, weekStart))
}

export function yearProgress(now: Date): number {
  return spanProgress(now, yearBounds(now))
}

/**
 * Life progress against a fixed lifespan. Returns `null` when the inputs cannot
 * describe a lifespan at all (no birth date, or a non-positive lifespan), which
 * the widget layer renders as "not configured" rather than as 0%.
 */
export function lifeProgress(
  now: Date,
  birthDate: Date | null,
  lifespanYears: number,
): number | null {
  if (!birthDate || !Number.isFinite(lifespanYears) || lifespanYears <= 0) {
    return null
  }
  return spanProgress(now, lifeBounds(birthDate, lifespanYears))
}

/** Whole days from `now` to the end of `span`, never negative. */
export function daysRemaining(now: Date, span: Span): number {
  const remaining = span.end.getTime() - now.getTime()
  if (remaining <= 0) return 0
  return Math.ceil(remaining / 86_400_000)
}
