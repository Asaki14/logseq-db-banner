import { describe, expect, it } from 'vitest'
import {
  formatBarWidth,
  formatIsoDate,
  formatMonthLabel,
  formatPercent,
} from './format'

describe('formatPercent', () => {
  it('renders one decimal by default', () => {
    expect(formatPercent(0.4237)).toBe('42.4%')
    expect(formatPercent(0)).toBe('0.0%')
    expect(formatPercent(1)).toBe('100.0%')
  })

  it('clamps out-of-range fractions', () => {
    expect(formatPercent(-1)).toBe('0.0%')
    expect(formatPercent(2)).toBe('100.0%')
    expect(formatPercent(Number.NaN)).toBe('0.0%')
  })

  it('honours the requested digit count within sane bounds', () => {
    expect(formatPercent(0.4237, 0)).toBe('42%')
    expect(formatPercent(0.4237, 3)).toBe('42.370%')
    expect(formatPercent(0.4237, -2)).toBe('42%')
    expect(formatPercent(0.4237, 99)).toBe('42.3700%')
  })
})

describe('formatBarWidth', () => {
  it('produces a CSS percentage', () => {
    expect(formatBarWidth(0.5)).toBe('50.000%')
    expect(formatBarWidth(0)).toBe('0.000%')
    expect(formatBarWidth(3)).toBe('100.000%')
  })
})

describe('formatMonthLabel', () => {
  it('names the month and year', () => {
    expect(formatMonthLabel(2026, 7)).toBe('July 2026')
    expect(formatMonthLabel(2026, 1)).toBe('January 2026')
    expect(formatMonthLabel(2026, 12)).toBe('December 2026')
  })
})

describe('formatIsoDate', () => {
  it('pads a journal day into an ISO date', () => {
    expect(formatIsoDate(20260725)).toBe('2026-07-25')
    expect(formatIsoDate(20260101)).toBe('2026-01-01')
  })
})
