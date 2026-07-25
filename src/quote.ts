/**
 * Pure quote selection: one quote per arrival on a journal view, picked from the
 * collected list by a seeded hash. The seed comes from the arrival, so the caller
 * decides when the quote moves — see `rotation.ts`, which holds a pick for the
 * whole visit so the per-second re-render cannot reshuffle it.
 */

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
 * re-read and move the pick, which — now that the pick deliberately varies per
 * visit — would be indistinguishable from an arrival.
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
 * splitmix32's finaliser: avalanches the low bits, so seeds one apart — which is
 * what two arrivals a millisecond apart are — land far apart in the list.
 */
function hash32(seed: number): number {
  let x = seed | 0
  x = Math.imul(x ^ (x >>> 16), 0x21f0aaad)
  x = Math.imul(x ^ (x >>> 15), 0x735a2d97)
  x = x ^ (x >>> 15)
  return x >>> 0
}

/**
 * The quote for `seed`, or `null` when there is nothing to pick from.
 *
 * `previous` — the quote the last visit showed — is excluded, so two arrivals in
 * a row never repeat themselves while there is anything else to show. A list of
 * one is the exception: repeating it beats blanking the widget.
 */
export function pickQuote(
  quotes: readonly string[],
  seed: number,
  previous: string | null = null,
): string | null {
  if (quotes.length === 0) return null
  const rest = quotes.filter((quote) => quote !== previous)
  const candidates = rest.length > 0 ? rest : quotes
  return candidates[hash32(seed) % candidates.length]
}
