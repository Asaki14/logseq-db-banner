import { describe, expect, it } from 'vitest'
import {
  clamp01,
  dayBounds,
  dayProgress,
  fromJournalDay,
  lifeBounds,
  lifeProgress,
  spanProgress,
  startOfLocalDay,
  toJournalDay,
  weekBounds,
  weekProgress,
  yearBounds,
  yearProgress,
} from './progress'

describe('clamp01', () => {
  it('clamps out-of-range and non-finite values', () => {
    expect(clamp01(-0.5)).toBe(0)
    expect(clamp01(1.5)).toBe(1)
    expect(clamp01(0.25)).toBe(0.25)
    expect(clamp01(Number.NaN)).toBe(0)
    expect(clamp01(Number.POSITIVE_INFINITY)).toBe(0)
  })
})

describe('day progress', () => {
  it('is exactly 0 at local midnight', () => {
    const midnight = new Date(2025, 6, 25, 0, 0, 0, 0)
    expect(midnight.getHours()).toBe(0)
    expect(dayProgress(midnight)).toBe(0)
  })

  it('is just below 1 at the last millisecond of the day', () => {
    const lastMs = new Date(2025, 6, 25, 23, 59, 59, 999)
    const progress = dayProgress(lastMs)
    expect(progress).toBeLessThan(1)
    expect(progress).toBeGreaterThan(0.9999)
  })

  it('restarts from 0 after crossing local midnight', () => {
    const beforeMidnight = dayProgress(new Date(2025, 6, 25, 23, 59))
    const afterMidnight = dayProgress(new Date(2025, 6, 26, 0, 0))
    expect(beforeMidnight).toBeGreaterThan(0.999)
    expect(afterMidnight).toBe(0)
  })

  it('is halfway at local noon', () => {
    // Exact only on days without a DST shift; 25 July has none anywhere.
    expect(dayProgress(new Date(2025, 6, 25, 12, 0))).toBeCloseTo(0.5, 6)
  })

  it('bounds a day by local midnights, so a DST day is not 24h', () => {
    // 30 March 2025 is the European DST start; the assertion holds in any zone.
    const { start, end } = dayBounds(new Date(2025, 2, 30, 15, 0))
    expect(start.getHours()).toBe(0)
    expect(end.getHours()).toBe(0)
    expect(end.getDate()).toBe(31)
    const hours = (end.getTime() - start.getTime()) / 3_600_000
    expect(hours).toBeGreaterThanOrEqual(23)
    expect(hours).toBeLessThanOrEqual(25)
  })
})

describe('week progress', () => {
  // 2025-07-25 is a Friday.
  const friday = new Date(2025, 6, 25, 12, 0)

  it('starts the week on the configured day', () => {
    expect(weekBounds(friday, 1).start.getDate()).toBe(21) // Monday
    expect(weekBounds(friday, 0).start.getDate()).toBe(20) // Sunday
    expect(weekBounds(friday, 6).start.getDate()).toBe(19) // Saturday
  })

  it('spans exactly seven calendar days', () => {
    const { start, end } = weekBounds(friday, 1)
    expect(end.getDate()).toBe(28)
    expect(start.getHours()).toBe(0)
    expect(end.getHours()).toBe(0)
  })

  it('is 0 at the first midnight of the configured week', () => {
    const monday = new Date(2025, 6, 21, 0, 0)
    expect(weekProgress(monday, 1)).toBe(0)
    // The same instant is already late in a Saturday-start week.
    expect(weekProgress(monday, 6)).toBeCloseTo(2 / 7, 2)
  })

  it('gives different fractions for different week starts', () => {
    expect(weekProgress(friday, 1)).toBeCloseTo(4.5 / 7, 2)
    expect(weekProgress(friday, 0)).toBeCloseTo(5.5 / 7, 2)
    expect(weekProgress(friday, 6)).toBeCloseTo(6.5 / 7, 2)
  })

  it('wraps to 0 on the configured start day', () => {
    const sunday = new Date(2025, 6, 27, 0, 0)
    expect(weekProgress(sunday, 0)).toBe(0)
    expect(weekProgress(sunday, 1)).toBeCloseTo(6 / 7, 2)
  })
})

describe('year progress', () => {
  it('is 0 at the first midnight of the year', () => {
    expect(yearProgress(new Date(2025, 0, 1, 0, 0))).toBe(0)
  })

  it('bounds the year by 1 January of this and the next year', () => {
    const { start, end } = yearBounds(new Date(2024, 6, 25))
    expect([start.getFullYear(), start.getMonth(), start.getDate()]).toEqual([
      2024, 0, 1,
    ])
    expect([end.getFullYear(), end.getMonth(), end.getDate()]).toEqual([
      2025, 0, 1,
    ])
  })

  it('divides by 366 days in a leap year', () => {
    // 29 February is day 60; noon on it is 59.5 days elapsed.
    expect(yearProgress(new Date(2024, 1, 29, 12, 0))).toBeCloseTo(59.5 / 366, 2)
  })

  it('advances more slowly in a leap year than in a common year', () => {
    const inLeapYear = yearProgress(new Date(2024, 1, 28, 0, 0))
    const inCommonYear = yearProgress(new Date(2023, 1, 28, 0, 0))
    expect(inCommonYear).toBeGreaterThan(inLeapYear)
  })

  it('is just below 1 at the last millisecond of the year', () => {
    expect(yearProgress(new Date(2024, 11, 31, 23, 59, 59, 999))).toBeLessThan(1)
    expect(yearProgress(new Date(2024, 11, 31, 23, 59, 59, 999))).toBeGreaterThan(
      0.9999,
    )
  })
})

describe('life progress', () => {
  const lifespan = 85

  it('needs a birth date', () => {
    expect(lifeProgress(new Date(2025, 6, 25), null, lifespan)).toBeNull()
  })

  it('rejects a non-positive or non-finite lifespan', () => {
    const birthDate = new Date(1990, 0, 1)
    const now = new Date(2025, 6, 25)
    expect(lifeProgress(now, birthDate, 0)).toBeNull()
    expect(lifeProgress(now, birthDate, -5)).toBeNull()
    expect(lifeProgress(now, birthDate, Number.NaN)).toBeNull()
  })

  it('is 0 on the day of birth', () => {
    const birthDate = new Date(2025, 6, 25)
    expect(lifeProgress(birthDate, birthDate, lifespan)).toBe(0)
  })

  it('clamps a birth date in the future to 0', () => {
    const now = new Date(2025, 6, 25)
    const birthDate = new Date(2030, 0, 1)
    expect(lifeProgress(now, birthDate, lifespan)).toBe(0)
  })

  it('clamps to 1 once the lifespan is exceeded', () => {
    const birthDate = new Date(1900, 0, 1)
    const now = new Date(2025, 6, 25)
    expect(lifeProgress(now, birthDate, lifespan)).toBe(1)
  })

  it('is 1 exactly on the day the lifespan runs out', () => {
    const birthDate = new Date(1940, 6, 25)
    expect(lifeProgress(new Date(2025, 6, 25), birthDate, lifespan)).toBe(1)
    expect(
      lifeProgress(new Date(2025, 6, 24, 23, 59), birthDate, lifespan),
    ).toBeLessThan(1)
  })

  it('is about half way at half the lifespan', () => {
    const birthDate = new Date(1983, 0, 1)
    expect(lifeProgress(new Date(2025, 6, 2), birthDate, lifespan)).toBeCloseTo(
      0.5,
      2,
    )
  })

  it('adds calendar years, keeping the birthday month and day', () => {
    const { start, end } = lifeBounds(new Date(1990, 4, 17, 9, 30), lifespan)
    expect([start.getHours(), start.getMinutes()]).toEqual([0, 0])
    expect([end.getFullYear(), end.getMonth(), end.getDate()]).toEqual([
      2075, 4, 17,
    ])
  })

  it('rolls a 29 February birth date to 1 March when the end year is common', () => {
    const { end } = lifeBounds(new Date(2000, 1, 29), lifespan)
    // 2085 is not a leap year, so 29 February overflows into 1 March.
    expect([end.getFullYear(), end.getMonth(), end.getDate()]).toEqual([
      2085, 2, 1,
    ])
  })

  it('keeps 29 February when the end year is also a leap year', () => {
    const { end } = lifeBounds(new Date(2000, 1, 29), 84)
    expect([end.getFullYear(), end.getMonth(), end.getDate()]).toEqual([
      2084, 1, 29,
    ])
  })
})

describe('spanProgress', () => {
  it('returns 0 for an empty or inverted span', () => {
    const instant = new Date(2025, 6, 25, 12)
    expect(spanProgress(instant, { start: instant, end: instant })).toBe(0)
    expect(
      spanProgress(instant, {
        start: new Date(2025, 6, 26),
        end: new Date(2025, 6, 25),
      }),
    ).toBe(0)
  })
})

describe('startOfLocalDay', () => {
  it('normalises to midnight and applies the day offset', () => {
    const start = startOfLocalDay(new Date(2025, 6, 25, 18, 42, 7, 500), -1)
    expect([start.getMonth(), start.getDate(), start.getHours()]).toEqual([
      6, 24, 0,
    ])
  })

  it('rolls across month and year boundaries', () => {
    const start = startOfLocalDay(new Date(2024, 11, 31, 10), 1)
    expect([start.getFullYear(), start.getMonth(), start.getDate()]).toEqual([
      2025, 0, 1,
    ])
  })
})

describe('journal day conversion', () => {
  it('formats a local date the way Logseq stores journalDay', () => {
    expect(toJournalDay(new Date(2026, 6, 25, 23, 59))).toBe(20260725)
    expect(toJournalDay(new Date(2026, 0, 1))).toBe(20260101)
    expect(toJournalDay(new Date(2024, 1, 29))).toBe(20240229)
  })

  it('reads a journal day back as local midnight', () => {
    const date = fromJournalDay(20260725)
    expect([date?.getFullYear(), date?.getMonth(), date?.getDate()]).toEqual([
      2026, 6, 25,
    ])
    expect(date?.getHours()).toBe(0)
  })

  it('round-trips every day of a leap year', () => {
    for (let day = new Date(2024, 0, 1); day.getFullYear() === 2024; ) {
      expect(fromJournalDay(toJournalDay(day))?.getTime()).toBe(day.getTime())
      day = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1)
    }
  })

  it('rejects values that are not a real date', () => {
    for (const value of [0, -1, 2026, 20261301, 20260732, 20260229, 1.5]) {
      expect(fromJournalDay(value)).toBeNull()
    }
  })
})
