import { describe, expect, it } from 'vitest'
import {
  collectQuotes,
  normalizeQuote,
  pickQuote,
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
    // order must produce the same list — otherwise the visit's pick would move.
    expect(collectQuotes(['- alpha', 'bravo'])).toEqual(collected)
  })

  it('returns nothing for an empty or unusable source', () => {
    expect(collectQuotes([])).toEqual([])
    expect(collectQuotes(['', '   ', null])).toEqual([])
  })
})

describe('pickQuote', () => {
  it('stays inside the list for any seed', () => {
    for (let seed = 0; seed < 200; seed += 1) {
      expect(QUOTES).toContain(pickQuote(QUOTES, seed))
    }
  })

  it('is a function of the seed alone, so one visit cannot drift', () => {
    expect(pickQuote(QUOTES, 1_770_000_000_123)).toBe(
      pickQuote(QUOTES, 1_770_000_000_123),
    )
  })

  it('moves with the seed', () => {
    const picks = Array.from({ length: 20 }, (_x, seed) =>
      pickQuote(QUOTES, 1_770_000_000_000 + seed),
    )
    expect(new Set(picks).size).toBeGreaterThan(1)
  })

  it('never repeats the quote just shown', () => {
    for (let seed = 0; seed < 500; seed += 1) {
      expect(pickQuote(QUOTES, seed, 'charlie')).not.toBe('charlie')
    }
  })

  it('spreads consecutive seeds over the whole list', () => {
    const counts = new Map<string, number>()
    for (let seed = 0; seed < 500; seed += 1) {
      const quote = pickQuote(QUOTES, seed) as string
      counts.set(quote, (counts.get(quote) ?? 0) + 1)
    }
    expect(counts.size).toBe(QUOTES.length)
    // An even split would be 100; nothing should be close to unused.
    for (const count of counts.values()) expect(count).toBeGreaterThan(40)
  })

  it('repeats the only quote there is rather than blanking', () => {
    expect(pickQuote(['only'], 1, 'only')).toBe('only')
    expect(pickQuote(['only'], 2)).toBe('only')
  })

  it('has nothing to pick from an empty list', () => {
    expect(pickQuote([], 1)).toBeNull()
    expect(pickQuote([], 1, 'alpha')).toBeNull()
  })
})
