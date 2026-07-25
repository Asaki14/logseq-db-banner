/**
 * When the quote moves: once per arrival on a journal view, never per render.
 *
 * The banner re-renders every second and the quote list is re-read whenever its
 * cache goes stale, so picking at render time would make the quote strobe. This
 * holds one pick until the user arrives somewhere else, and an arrival is a change
 * of the journal view's identity (`journalViewKey` in `journal.ts`): another
 * journal day, the feed instead of a day, or a journal view again after a page
 * that is not one. Navigating from one journal day to another is therefore two
 * visits with two quotes, which is what "a new quote every time I open a journal
 * page" means to a user.
 *
 * The identity, rather than the route event, is what an arrival hangs on because
 * Logseq fires `onRouteChanged` twice for one navigation (verified on 2.0.1: two
 * events about 18ms apart). Picking per event showed the second pick and left the
 * first as the quote to avoid, so a visit could repeat the quote just on screen.
 */

import { pickQuote } from './quote'

export interface QuoteRotation {
  /**
   * The journal view the app is showing, or `null` for anything that is not one.
   * Called on every tick; a new key is an arrival and rotates the quote.
   */
  observe(journalKey: string | null): void
  /** The quote for the current visit — chosen once, then held until the next arrival. */
  current(quotes: readonly string[]): string | null
}

/** `nextSeed` is injectable so tests do not depend on the clock. */
export function createQuoteRotation(
  nextSeed: () => number = Date.now,
): QuoteRotation {
  let visitedKey: string | null = null
  let seed = nextSeed()
  let picked: string | null = null
  let previous: string | null = null

  return {
    observe(journalKey) {
      if (journalKey === visitedKey) return
      visitedKey = journalKey
      if (journalKey === null) return
      // A visit that never got as far as a pick — the quote data had not landed
      // yet — must not forget what was on screen before it.
      if (picked !== null) previous = picked
      picked = null
      seed = nextSeed()
    },
    current(quotes) {
      // Held across every tick of the visit, and across a cache refresh that
      // hands back a list still containing the quote on screen.
      if (picked !== null && quotes.includes(picked)) return picked
      picked = pickQuote(quotes, seed, previous)
      return picked
    },
  }
}
