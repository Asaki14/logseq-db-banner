/**
 * The live host adapter: the only place that talks to the graph on behalf of a
 * widget. Every call fails soft — a rejected query becomes an empty result and
 * the widget renders its "nothing to show" state instead of an error.
 *
 * Runtime shapes verified against Logseq 2.0.1 (DB graph); see `AGENTS.md`.
 */

import { fromJournalDay } from './progress'
import {
  journalContentQuery,
  journalPageQuery,
  taggedTextsQuery,
} from './query'
import type { WidgetHost } from './widgets'

export const widgetHost: WidgetHost = {
  async journalDaysWithContent(from, to) {
    const rows = await logseq.DB.datascriptQuery<unknown>(
      journalContentQuery(from, to),
    )
    return readNumbers(rows)
  },

  async taggedTexts(tag) {
    const rows = await logseq.DB.datascriptQuery<unknown>(
      taggedTextsQuery(tag),
    )
    return readStrings(rows)
  },
}

/**
 * Open a journal day, creating its page when it does not exist yet.
 *
 * Navigating straight to a missing journal page renders a blank content column
 * (verified: `pushState` succeeds, the route becomes `page`, and
 * `getCurrentPage()` stays `null`), so the page is materialised first.
 * `createJournalPage` is called with epoch milliseconds: despite the
 * `string | Date` typing, a string is silently ignored and a number is read as a
 * timestamp, and a `Date` does not survive the plugin bridge as a `Date`.
 *
 * It is idempotent, but it is *not* a reliable way to identify the day: it
 * answers `null` for a journal page that already exists and holds no blocks,
 * while a page it just created and a page with content both come back as full
 * entities. An empty day is the ordinary case for a day nobody has written on,
 * so the day is resolved from the graph whenever the create call declines to
 * name it.
 */
export async function openJournalDay(day: number): Promise<void> {
  const date = fromJournalDay(day)
  if (!date) return

  try {
    const created = await logseq.Editor.createJournalPage(
      date.getTime() as unknown as Date,
    )
    const name = readPageName(created) ?? (await readJournalPageUuid(day))
    if (!name) return
    logseq.App.pushState('page', { name })
  } catch (error) {
    console.warn('[db-banner] Could not open the journal page for', day, error)
  }
}

/** The existing journal page's uuid, which `pushState` accepts as a name. */
async function readJournalPageUuid(day: number): Promise<string | null> {
  const rows = await logseq.DB.datascriptQuery<unknown>(journalPageQuery(day))
  return readStrings(rows)[0] ?? null
}

function readPageName(page: unknown): string | null {
  if (typeof page !== 'object' || page === null) return null
  const { name, uuid } = page as Record<string, unknown>
  if (typeof name === 'string' && name !== '') return name
  return typeof uuid === 'string' && uuid !== '' ? uuid : null
}

function readNumbers(rows: unknown): number[] {
  if (!Array.isArray(rows)) return []
  const numbers: number[] = []
  for (const row of rows.flat()) {
    const value = typeof row === 'string' ? Number(row) : row
    if (typeof value === 'number' && Number.isFinite(value)) numbers.push(value)
  }
  return numbers
}

function readStrings(rows: unknown): string[] {
  if (!Array.isArray(rows)) return []
  return rows.flat().filter((row): row is string => typeof row === 'string')
}
