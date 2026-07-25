/**
 * Pure quote selection: one quote per calendar day, picked from the collected
 * list by a date-seeded hash. The same date always yields the same quote, so a
 * re-mount (or the per-second re-render) cannot reshuffle it, and consecutive
 * days scatter across the list rather than walking it in order.
 */

import { toJournalDay } from './progress'

/** Longest quote kept; the stylesheet also clamps the rendered height. */
export const QUOTE_MAX_LENGTH = 240

/**
 * Collapse whitespace and drop the block markup that would read as noise on one
 * line. Returns `''` for anything that is not usable text.
 */
export function normalizeQuote(value: unknown): string {
  if (typeof value !== 'string') return ''
  return value
    .replace(/\r/g, '')
    .replace(/^[\s>*-]*[-*>]\s+/, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Bound a quote's length, so one long block cannot flood the banner. */
export function truncateQuote(text: string, max = QUOTE_MAX_LENGTH): string {
  if (text.length <= max) return text
  const head = text.slice(0, max)
  const lastSpace = head.lastIndexOf(' ')
  // Prefer a word boundary, but only when it does not cut the quote in half.
  return `${(lastSpace > max * 0.6 ? head.slice(0, lastSpace) : head).trimEnd()}…`
}

/**
 * Normalise, bound and de-duplicate raw block texts into quote candidates.
 *
 * The list is sorted, because a datascript result set has no guaranteed order:
 * without this, the same blocks could come back in a different order after a
 * re-mount and move the day's pick.
 */
export function collectQuotes(values: readonly unknown[]): string[] {
  const seen = new Set<string>()
  for (const value of values) {
    const text = normalizeQuote(value)
    if (text) seen.add(truncateQuote(text))
  }
  return [...seen].sort()
}

/**
 * splitmix32's finaliser: avalanches the low bits, so seeds one apart (which is
 * what consecutive days are) land far apart in the list.
 */
function hash32(seed: number): number {
  let x = seed | 0
  x = Math.imul(x ^ (x >>> 16), 0x21f0aaad)
  x = Math.imul(x ^ (x >>> 15), 0x735a2d97)
  x = x ^ (x >>> 15)
  return x >>> 0
}

/** Index into a list of `length` items for `date`, stable for the whole day. */
export function dateSeededIndex(length: number, date: Date): number {
  if (!Number.isInteger(length) || length <= 0) return -1
  return hash32(toJournalDay(date)) % length
}

/** The quote for `date`, or `null` when there is nothing to pick from. */
export function pickQuoteForDate(
  quotes: readonly string[],
  date: Date,
): string | null {
  const index = dateSeededIndex(quotes.length, date)
  return index < 0 ? null : quotes[index]
}
