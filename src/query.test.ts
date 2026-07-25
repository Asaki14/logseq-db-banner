import { describe, expect, it } from 'vitest'
import {
  escapeQueryString,
  journalContentQuery,
  journalPageQuery,
  taggedTextsQuery,
} from './query'

describe('escapeQueryString', () => {
  it('escapes the characters that would end a query literal', () => {
    expect(escapeQueryString('quotes')).toBe('quotes')
    expect(escapeQueryString('a"b')).toBe('a\\"b')
    expect(escapeQueryString('a\\b')).toBe('a\\\\b')
  })

  it('cannot be used to close the literal and append clauses', () => {
    const query = taggedTextsQuery('x" ] [?p :block/name "y')
    expect(query).toContain('[?tag :block/name "x\\" ] [?p :block/name \\"y"]')
  })
})

describe('journalContentQuery', () => {
  it('interpolates the day range, because inputs never reach the query', () => {
    const query = journalContentQuery(20260701, 20260731)
    expect(query).toContain('[(>= ?day 20260701)]')
    expect(query).toContain('[(<= ?day 20260731)]')
    expect(query).not.toContain(':in')
  })

  it('can only ever interpolate a whole number', () => {
    const query = journalContentQuery(Number.NaN, 20260731.7)
    expect(query).toContain('[(>= ?day 0)]')
    expect(query).toContain('[(<= ?day 20260731)]')
  })

  it('asks for days whose page has a non-empty block, not merely a page', () => {
    const query = journalContentQuery(20260701, 20260731)
    expect(query).toContain('[?block :block/page ?page]')
    expect(query).toContain('[(not= ?title "")]')
  })

  it('returns a flat collection of days', () => {
    expect(journalContentQuery(1, 2)).toContain('[:find [?day ...]')
  })
})

describe('journalPageQuery', () => {
  it('asks for the uuid of the page of one journal day', () => {
    const query = journalPageQuery(20260712)
    expect(query).toContain('[?page :block/journal-day 20260712]')
    expect(query).toContain('[?page :block/uuid ?uuid]')
    expect(query).toContain('[:find [?uuid ...]')
    expect(query).not.toContain(':in')
  })

  it('finds a page that exists whether or not it holds any block', () => {
    expect(journalPageQuery(20260712)).not.toContain(':block/title')
  })

  it('can only ever interpolate a whole number', () => {
    expect(journalPageQuery(Number.POSITIVE_INFINITY)).toContain(
      ':block/journal-day 0]',
    )
  })
})

describe('taggedTextsQuery', () => {
  it('interpolates the tag name, which does not bind as an input', () => {
    expect(taggedTextsQuery('quotes')).toContain(
      '[?tag :block/name "quotes"]',
    )
    expect(taggedTextsQuery('quotes')).not.toContain(':in')
  })

  it('collects the blocks carrying the tag, at any depth', () => {
    const query = taggedTextsQuery('quote')
    expect(query).toContain('[?block :block/tags ?tag]')
    // Blocks only: a page has no `:block/page`, so a tagged page cannot
    // contribute its own title.
    expect(query).toContain('[?block :block/page _]')
  })

  it('still collects the top-level blocks of tagged pages', () => {
    const query = taggedTextsQuery('quotes')
    expect(query).toContain('[?page :block/tags ?tag]')
    // A top-level block's parent is the page itself.
    expect(query).toContain('[?block :block/parent ?page]')
  })

  it('unions the two shapes rather than choosing one', () => {
    expect(taggedTextsQuery('quotes')).toContain('(or-join [?block ?tag]')
  })

  it('leaves out empty blocks and property values', () => {
    const query = taggedTextsQuery('quotes')
    expect(query).toContain('[(not= ?title "")]')
    expect(query).toContain(
      '(not [?block :logseq.property/created-from-property _])',
    )
  })
})
