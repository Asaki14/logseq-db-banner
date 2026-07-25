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
