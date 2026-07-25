import { describe, expect, it } from 'vitest'
import {
  escapeQueryString,
  journalContentQuery,
  journalPageQuery,
  taggedPageTextsQuery,
} from './query'

describe('escapeQueryString', () => {
  it('escapes the characters that would end a query literal', () => {
    expect(escapeQueryString('quotes')).toBe('quotes')
    expect(escapeQueryString('a"b')).toBe('a\\"b')
    expect(escapeQueryString('a\\b')).toBe('a\\\\b')
  })

  it('cannot be used to close the literal and append clauses', () => {
    const query = taggedPageTextsQuery('x" ] [?p :block/name "y')
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

describe('taggedPageTextsQuery', () => {
  it('interpolates the tag name, which does not bind as an input', () => {
    expect(taggedPageTextsQuery('quotes')).toContain(
      '[?tag :block/name "quotes"]',
    )
    expect(taggedPageTextsQuery('quotes')).not.toContain(':in')
  })

  it('collects only top-level blocks of tagged pages', () => {
    const query = taggedPageTextsQuery('quotes')
    expect(query).toContain('[?page :block/tags ?tag]')
    // A top-level block's parent is the page itself.
    expect(query).toContain('[?block :block/parent ?page]')
    expect(query).toContain(
      '(not [?block :logseq.property/created-from-property _])',
    )
  })
})
