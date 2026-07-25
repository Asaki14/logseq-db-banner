import { describe, expect, it } from 'vitest'
import { createQuoteRotation, type QuoteRotation } from './rotation'

const QUOTES = ['alpha', 'bravo', 'charlie', 'delta', 'echo']

const DAY = 'page:20260724'
const OTHER_DAY = 'page:20260723'
const FEED = 'home:feed'

/** Deterministic seeds, so a test never depends on the clock. */
function rotation(): QuoteRotation {
  let seed = 0
  return createQuoteRotation(() => {
    seed += 1
    return seed * 1_000
  })
}

/** What the per-second tick does: observe the same view, then render from it. */
function ticks(
  subject: QuoteRotation,
  count: number,
  key = DAY,
): (string | null)[] {
  return Array.from({ length: count }, () => {
    subject.observe(key)
    return subject.current(QUOTES)
  })
}

describe('createQuoteRotation', () => {
  it('holds one quote for the whole visit, however often it is rendered', () => {
    const rendered = ticks(rotation(), 10)
    expect(new Set(rendered).size).toBe(1)
    expect(QUOTES).toContain(rendered[0])
  })

  it('picks again on the next journal day', () => {
    const subject = rotation()
    subject.observe(DAY)
    const first = subject.current(QUOTES)

    subject.observe(OTHER_DAY)
    const second = subject.current(QUOTES)
    expect(second).not.toBe(first)
    // …and then holds that one for the rest of the visit.
    expect(ticks(subject, 5, OTHER_DAY)).toEqual(Array(5).fill(second))
  })

  it('picks again when a journal view comes back after another page', () => {
    const subject = rotation()
    subject.observe(DAY)
    const first = subject.current(QUOTES)

    subject.observe(null) // a page that is not a journal
    subject.observe(DAY) // and back to the same day
    expect(subject.current(QUOTES)).not.toBe(first)
  })

  it('picks again when the feed replaces a single day', () => {
    const subject = rotation()
    subject.observe(DAY)
    const first = subject.current(QUOTES)

    subject.observe(FEED)
    expect(subject.current(QUOTES)).not.toBe(first)
  })

  it('rotates once per navigation, not once per route event', () => {
    // Logseq fires `onRouteChanged` twice for one navigation, so the same view is
    // observed again a few milliseconds later; that must not move the quote —
    // showing the second pick would leave the first as the one to avoid, and the
    // visit after it could then repeat the quote just on screen.
    const subject = rotation()
    subject.observe(DAY)
    const first = subject.current(QUOTES)
    subject.observe(DAY)
    expect(subject.current(QUOTES)).toBe(first)

    subject.observe(OTHER_DAY)
    const second = subject.current(QUOTES)
    subject.observe(OTHER_DAY)
    expect(subject.current(QUOTES)).toBe(second)

    subject.observe(DAY)
    expect(subject.current(QUOTES)).not.toBe(second)
  })

  it('keeps the pick across a data refresh that still holds it', () => {
    const subject = rotation()
    subject.observe(DAY)
    const first = subject.current(QUOTES) as string
    // A cache revalidation hands back the same texts as a new array.
    expect(subject.current([...QUOTES])).toBe(first)
    // …and the same list with something added.
    expect(subject.current([...QUOTES, 'foxtrot'])).toBe(first)
  })

  it('picks again when the quote on screen has left the graph', () => {
    const subject = rotation()
    subject.observe(DAY)
    const first = subject.current(QUOTES) as string
    const rest = QUOTES.filter((quote) => quote !== first)
    expect(rest).toContain(subject.current(rest))
  })

  it('renders the single candidate on every visit instead of blanking', () => {
    const subject = rotation()
    for (const key of [DAY, OTHER_DAY, DAY, FEED, DAY]) {
      subject.observe(key)
      expect(subject.current(['only'])).toBe('only')
      expect(subject.current(['only'])).toBe('only')
    }
  })

  it('has nothing to show while the quote data has not landed', () => {
    const subject = rotation()
    subject.observe(DAY)
    expect(subject.current([])).toBeNull()
    // The pick belongs to this visit even though it happened a tick late.
    const first = subject.current(QUOTES)
    expect(subject.current(QUOTES)).toBe(first)
  })

  it('does not forget the quote on screen across a visit that never picked', () => {
    const subject = rotation()
    subject.observe(DAY)
    const first = subject.current(QUOTES)

    // A journal view whose quote data was still loading, then a third arrival.
    subject.observe(OTHER_DAY)
    subject.current([])
    subject.observe(DAY)
    expect(subject.current(QUOTES)).not.toBe(first)
  })

  it('stays put while the app is nowhere near a journal view', () => {
    const subject = rotation()
    subject.observe(null)
    subject.observe(null)
    subject.observe(DAY)
    const first = subject.current(QUOTES)
    subject.observe(DAY)
    expect(subject.current(QUOTES)).toBe(first)
  })
})
