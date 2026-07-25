import { describe, expect, it } from 'vitest'
import {
  collectQuotes,
  dateSeededIndex,
  normalizeQuote,
  pickQuoteForDate,
  QUOTE_MAX_LENGTH,
  truncateQuote,
} from './quote'

const QUOTES = ['alpha', 'bravo', 'charlie', 'delta', 'echo']

describe('normalizeQuote', () => {
  it('collapses whitespace and trims', () => {
    expect(normalizeQuote('  a   long \n  quote ')).toBe('a long quote')
  })

  it('drops a leading bullet or blockquote marker', () => {
    expect(normalizeQuote('- be here now')).toBe('be here now')
    expect(normalizeQuote('> be here now')).toBe('be here now')
    expect(normalizeQuote('* be here now')).toBe('be here now')
  })

  it('keeps a hyphen that is part of the text', () => {
    expect(normalizeQuote('well-being matters')).toBe('well-being matters')
  })

  it('rejects anything that is not usable text', () => {
    expect(normalizeQuote('   ')).toBe('')
    expect(normalizeQuote(undefined)).toBe('')
    expect(normalizeQuote(42)).toBe('')
    expect(normalizeQuote(null)).toBe('')
  })
})

describe('truncateQuote', () => {
  it('leaves a short quote alone', () => {
    expect(truncateQuote('short')).toBe('short')
  })

  it('bounds a long quote and marks the cut', () => {
    const long = 'word '.repeat(200).trim()
    const bounded = truncateQuote(long)
    expect(bounded.length).toBeLessThanOrEqual(QUOTE_MAX_LENGTH + 1)
    expect(bounded.endsWith('…')).toBe(true)
    expect(bounded.endsWith(' …')).toBe(false)
  })

  it('cuts mid-word rather than throwing most of the quote away', () => {
    const single = 'x'.repeat(400)
    expect(truncateQuote(single, 10)).toBe(`${'x'.repeat(10)}…`)
  })
})

describe('collectQuotes', () => {
  it('normalises, bounds, de-duplicates and orders independently of the input', () => {
    const collected = collectQuotes([
      'bravo',
      '  bravo  ',
      '- alpha',
      42,
      '',
      null,
    ])
    expect(collected).toEqual(['alpha', 'bravo'])
    // Query results arrive as an unordered set, so the same texts in another
    // order must produce the same list — otherwise the day's pick would move.
    expect(collectQuotes(['- alpha', 'bravo'])).toEqual(collected)
  })

  it('returns nothing for an empty or unusable source', () => {
    expect(collectQuotes([])).toEqual([])
    expect(collectQuotes(['', '   ', null])).toEqual([])
  })
})

describe('dateSeededIndex', () => {
  it('has no index for an empty list', () => {
    expect(dateSeededIndex(0, new Date(2026, 6, 25))).toBe(-1)
  })

  it('stays inside the list', () => {
    for (let day = 1; day <= 28; day += 1) {
      const index = dateSeededIndex(QUOTES.length, new Date(2026, 1, day))
      expect(index).toBeGreaterThanOrEqual(0)
      expect(index).toBeLessThan(QUOTES.length)
    }
  })
})

describe('pickQuoteForDate', () => {
  it('is stable for the whole calendar day', () => {
    const morning = pickQuoteForDate(QUOTES, new Date(2026, 6, 25, 0, 0, 0))
    const noon = pickQuoteForDate(QUOTES, new Date(2026, 6, 25, 12, 34, 56))
    const night = pickQuoteForDate(QUOTES, new Date(2026, 6, 25, 23, 59, 59))
    expect(morning).toBe(noon)
    expect(noon).toBe(night)
  })

  it('changes across days', () => {
    const week = Array.from({ length: 7 }, (_x, offset) =>
      pickQuoteForDate(QUOTES, new Date(2026, 6, 20 + offset)),
    )
    expect(new Set(week).size).toBeGreaterThan(1)
  })

  it('does not walk the list in order on consecutive days', () => {
    const indexes = Array.from({ length: 6 }, (_x, offset) =>
      QUOTES.indexOf(
        pickQuoteForDate(QUOTES, new Date(2026, 6, 1 + offset)) as string,
      ),
    )
    const stepsOfOne = indexes
      .slice(1)
      .filter((index, i) => index === (indexes[i] + 1) % QUOTES.length)
    expect(stepsOfOne.length).toBeLessThan(indexes.length - 1)
  })

  it('spreads a year over the whole list', () => {
    const counts = new Map<string, number>()
    for (let day = 0; day < 365; day += 1) {
      const quote = pickQuoteForDate(QUOTES, new Date(2026, 0, 1 + day))
      counts.set(quote as string, (counts.get(quote as string) ?? 0) + 1)
    }
    expect(counts.size).toBe(QUOTES.length)
    // An even split would be 73 a year; nothing should be close to unused.
    for (const count of counts.values()) expect(count).toBeGreaterThan(30)
  })

  it('is deterministic across processes for a known date', () => {
    // Pins the hash, so a change of algorithm cannot silently reshuffle
    // everyone's quote of the day.
    expect(pickQuoteForDate(QUOTES, new Date(2026, 6, 25))).toBe('alpha')
    expect(pickQuoteForDate(QUOTES, new Date(2026, 6, 26))).toBe('delta')
  })

  it('always picks the only quote there is', () => {
    expect(pickQuoteForDate(['only'], new Date(2026, 6, 25))).toBe('only')
  })

  it('has nothing to pick from an empty list', () => {
    expect(pickQuoteForDate([], new Date(2026, 6, 25))).toBeNull()
  })
})
