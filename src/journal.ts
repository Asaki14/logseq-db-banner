/**
 * Journal-only mount decision, kept pure so it is testable without a live host.
 *
 * The host signals are read once in `main.ts` and normalised here, because the
 * shapes the plugin API actually returns in Logseq 2.0.1 DB graphs are narrower
 * than the typings promise: a page entity carries neither `journal?` nor `type`,
 * only a camelCase `journalDay` (`20260725`) that is absent on other pages.
 */

/** Route name for the scrolling multi-day journal views. */
const JOURNAL_FEED_ROUTES = new Set(['home', 'allJournals'])
/** Route name for `/page/:name`, journal or not. */
const PAGE_ROUTE = 'page'

export interface HostPage {
  /** `YYYYMMDD` for a journal page, `null` for anything else. */
  journalDay: number | null
}

export interface HostView {
  /** Current route name, or `null` when the host reports no match. */
  routeName: string | null
  /** Current page, or `null` on feed and utility routes. */
  page: HostPage | null
}

/** Normalise the raw route name and current page the host handed back. */
export function toHostView(rawRouteName: unknown, rawPage: unknown): HostView {
  return { routeName: readRouteName(rawRouteName), page: readPage(rawPage) }
}

/**
 * A banner belongs on a journal view only: the journals feed, or a single
 * journal page. Everything else — normal pages, all-pages, search, settings,
 * graph, whiteboards, plugin pages, an unmatched route — gets none.
 */
export function shouldMountBanner(view: HostView): boolean {
  if (view.routeName === PAGE_ROUTE) {
    return view.page?.journalDay != null
  }
  if (view.routeName !== null && JOURNAL_FEED_ROUTES.has(view.routeName)) {
    // A custom default home page renders on the journals route without being
    // a journal, and is reported as the current page.
    return view.page === null || view.page.journalDay !== null
  }
  return false
}

/**
 * Identity of the journal view on screen, or `null` when this is not one — what
 * "the user arrived somewhere new" means for anything anchored to a visit rather
 * than to a render (the quote, see `rotation.ts`).
 *
 * The route name is part of the key, so opening today's own page from the journals
 * feed counts as an arrival even though it is the same day.
 */
export function journalViewKey(view: HostView): string | null {
  if (!shouldMountBanner(view)) return null
  return `${view.routeName ?? ''}:${view.page?.journalDay ?? 'feed'}`
}

function readRouteName(rawRouteName: unknown): string | null {
  return typeof rawRouteName === 'string' && rawRouteName !== ''
    ? rawRouteName
    : null
}

function readPage(rawPage: unknown): HostPage | null {
  const page = readRecord(rawPage)
  if (!page) return null
  return { journalDay: readJournalDay(page.journalDay ?? page['journal-day']) }
}

/** Only a positive `YYYYMMDD` integer counts; anything else means "not a journal". */
function readJournalDay(value: unknown): number | null {
  const day = typeof value === 'string' ? Number(value) : value
  if (typeof day !== 'number' || !Number.isInteger(day) || day <= 0) return null
  return day
}

function readRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : null
}
