/**
 * The datascript queries the widgets need, kept pure so their shape is testable.
 *
 * Every value is interpolated into the query text rather than passed through
 * `:in`. `logseq.DB.datascriptQuery(query, ...inputs)` is typed as variadic, but
 * across the plugin bridge in Logseq 2.0.1 the inputs never arrive: a query
 * declaring `:in $ ?from` fails with "Too few inputs passed, expected:
 * [$ ?from], got: 1" no matter how they are passed. So the query text is the only
 * channel, and a string that ends up in it has to be escaped.
 */

/** Escape a string for a datascript query literal. */
export function escapeQueryString(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

/** A number safe to interpolate: a whole number, or `0` for anything else. */
function toQueryInteger(value: number): number {
  return Number.isFinite(value) ? Math.trunc(value) : 0
}

/**
 * Journal days in `[from, to]` whose page holds at least one non-empty block.
 * A journal page that exists but was never written to is left out, which is what
 * makes this "has content" rather than "exists".
 */
export function journalContentQuery(from: number, to: number): string {
  return `
[:find [?day ...]
 :where
 [?page :block/journal-day ?day]
 [?block :block/page ?page]
 [?block :block/title ?title]
 [(not= ?title "")]
 [(>= ?day ${toQueryInteger(from)})]
 [(<= ?day ${toQueryInteger(to)})]]
`
}

/**
 * Top-level block texts of every page tagged `tagName`. `:block/parent` of a
 * top-level block is the page itself, so that clause is what excludes nested
 * blocks; property values live on the page as blocks too and are excluded by
 * `:logseq.property/created-from-property`.
 */
export function taggedPageTextsQuery(tagName: string): string {
  return `
[:find [?title ...]
 :where
 [?tag :block/name "${escapeQueryString(tagName)}"]
 [?page :block/tags ?tag]
 [?block :block/page ?page]
 [?block :block/parent ?page]
 [?block :block/title ?title]
 (not [?block :logseq.property/created-from-property _])]
`
}
