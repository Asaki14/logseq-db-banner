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
 * The `:block/uuid` of the journal page for `day`, empty when that day has no
 * page. Needed because `createJournalPage` refuses to identify a journal page
 * that already exists and holds no blocks — see `openJournalDay`.
 */
export function journalPageQuery(day: number): string {
  return `
[:find [?uuid ...]
 :where
 [?page :block/journal-day ${toQueryInteger(day)}]
 [?page :block/uuid ?uuid]]
`
}

/**
 * Block texts belonging to the tag named `tagName`, from either of the two
 * shapes a tag is worn in a DB graph:
 *
 * - the block itself carries the tag (`:block/tags`), at any depth. This is what
 *   a built-in class looks like: `Quote` is `:logseq.class/Quote-block`, a tag
 *   entity whose `:block/title` is `Quote` and whose `:block/name` is `quote`
 *   just like a user-made tag, and the file-graph importer attaches it to the
 *   blocks that were tagged `#quote`. Nothing is tagged at the *page* level, so
 *   only this branch finds them.
 * - the block is a top-level block of a page carrying the tag. `:block/parent`
 *   of a top-level block is the page itself, so that clause is what excludes
 *   nested blocks.
 *
 * `[?block :block/page _]` keeps the first branch to blocks: a page has no
 * `:block/page`, so a tagged *page* cannot contribute its own title as a quote.
 * Property values live on their page as blocks too and are excluded by
 * `:logseq.property/created-from-property`.
 */
export function taggedTextsQuery(tagName: string): string {
  return `
[:find [?title ...]
 :where
 [?tag :block/name "${escapeQueryString(tagName)}"]
 (or-join [?block ?tag]
  (and
   [?block :block/tags ?tag]
   [?block :block/page _])
  (and
   [?page :block/tags ?tag]
   [?block :block/page ?page]
   [?block :block/parent ?page]))
 [?block :block/title ?title]
 [(not= ?title "")]
 (not [?block :logseq.property/created-from-property _])]
`
}
