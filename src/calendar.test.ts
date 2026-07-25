import { describe, expect, it } from 'vitest'
import { buildCalendarGrid, daysInMonth, type CalendarCell } from './calendar'
import type { WeekStart } from './progress'

const MONDAY: WeekStart = 1
const SUNDAY: WeekStart = 0
const SATURDAY: WeekStart = 6

function flatten(weekStart: WeekStart, now: Date): CalendarCell[] {
  return buildCalendarGrid(now, weekStart).weeks.flat()
}

function dayNumbers(cells: CalendarCell[]): (number | null)[] {
  return cells.map((cell) => cell.day)
}

describe('daysInMonth', () => {
  it('knows the ordinary month lengths', () => {
    expect(daysInMonth(2026, 1)).toBe(31)
    expect(daysInMonth(2026, 4)).toBe(30)
    expect(daysInMonth(2026, 12)).toBe(31)
  })

  it('handles February across leap rules', () => {
    expect(daysInMonth(2026, 2)).toBe(28)
    expect(daysInMonth(2024, 2)).toBe(29)
    // Divisible by 100 but not 400: not a leap year.
    expect(daysInMonth(2100, 2)).toBe(28)
    // Divisible by 400: a leap year.
    expect(daysInMonth(2000, 2)).toBe(29)
  })
})

describe('buildCalendarGrid', () => {
  it('reports the month it was asked about', () => {
    const grid = buildCalendarGrid(new Date(2026, 6, 25), MONDAY)
    expect(grid.year).toBe(2026)
    expect(grid.month).toBe(7)
  })

  it('starts the first column at the configured week start', () => {
    const now = new Date(2026, 6, 25)
    expect(buildCalendarGrid(now, MONDAY).weekdayLabels[0]).toBe('Mo')
    expect(buildCalendarGrid(now, SUNDAY).weekdayLabels[0]).toBe('Su')
    expect(buildCalendarGrid(now, SATURDAY).weekdayLabels[0]).toBe('Sa')
    expect(buildCalendarGrid(now, SATURDAY).weekdayLabels).toEqual([
      'Sa',
      'Su',
      'Mo',
      'Tu',
      'We',
      'Th',
      'Fr',
    ])
  })

  it('pads the first row so the 1st lands under its weekday', () => {
    // 1 July 2026 is a Wednesday.
    const now = new Date(2026, 6, 25)
    expect(dayNumbers(flatten(MONDAY, now)).indexOf(1)).toBe(2)
    expect(dayNumbers(flatten(SUNDAY, now)).indexOf(1)).toBe(3)
    expect(dayNumbers(flatten(SATURDAY, now)).indexOf(1)).toBe(4)
  })

  it('emits whole weeks of seven cells and every day exactly once', () => {
    for (const weekStart of [MONDAY, SUNDAY, SATURDAY] as WeekStart[]) {
      for (const month of [0, 1, 3, 11]) {
        const grid = buildCalendarGrid(new Date(2026, month, 15), weekStart)
        for (const week of grid.weeks) expect(week).toHaveLength(7)

        const days = grid.weeks
          .flat()
          .map((cell) => cell.day)
          .filter((day): day is number => day !== null)
        expect(days).toEqual(
          Array.from({ length: daysInMonth(2026, month + 1) }, (_x, i) => i + 1),
        )
      }
    }
  })

  it('keeps a leap day and drops it the following year', () => {
    const leap = flatten(MONDAY, new Date(2024, 1, 10))
    expect(dayNumbers(leap)).toContain(29)
    const common = flatten(MONDAY, new Date(2026, 1, 10))
    expect(dayNumbers(common)).not.toContain(29)
  })

  it('needs no padding for a 28 day February that starts on the first column', () => {
    // 1 February 2026 is a Sunday, so a Sunday-first grid is exactly four weeks.
    const grid = buildCalendarGrid(new Date(2026, 1, 10), SUNDAY)
    expect(grid.weeks).toHaveLength(4)
    expect(grid.weeks[0][0].day).toBe(1)
    expect(grid.weeks[3][6].day).toBe(28)
  })

  it('spreads a 31 day month over six weeks when it starts late in one', () => {
    // 1 August 2026 is a Saturday: Monday-first needs six rows.
    expect(buildCalendarGrid(new Date(2026, 7, 10), MONDAY).weeks).toHaveLength(6)
    expect(buildCalendarGrid(new Date(2026, 7, 10), SATURDAY).weeks).toHaveLength(5)
  })

  it('numbers cells as journal days and marks today', () => {
    const cells = flatten(MONDAY, new Date(2026, 6, 25, 9, 30))
    const today = cells.find((cell) => cell.isToday)
    expect(today?.journalDay).toBe(20260725)
    expect(cells.filter((cell) => cell.isToday)).toHaveLength(1)
    expect(cells.find((cell) => cell.day === 1)?.journalDay).toBe(20260701)
  })

  it('marks the days the content predicate reports, and only those', () => {
    const grid = buildCalendarGrid(new Date(2026, 6, 25), MONDAY, (day) =>
      day === 20260720 || day === 20260725,
    )
    const marked = grid.weeks
      .flat()
      .filter((cell) => cell.hasContent)
      .map((cell) => cell.journalDay)
    expect(marked).toEqual([20260720, 20260725])
  })

  it('leaves padding cells inert', () => {
    const padding = flatten(MONDAY, new Date(2026, 6, 25)).filter(
      (cell) => cell.day === null,
    )
    expect(padding.length).toBeGreaterThan(0)
    for (const cell of padding) {
      expect(cell.journalDay).toBeNull()
      expect(cell.isToday).toBe(false)
      expect(cell.hasContent).toBe(false)
    }
  })
})
