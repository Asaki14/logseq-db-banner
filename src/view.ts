/**
 * The widget/DOM boundary. A widget describes itself as a plain node tree, and
 * the host-document layer materialises it. Keeping the description as data means
 * every widget — progress bar, calendar grid, quote — is unit testable without a
 * DOM, and `banner.ts` needs no knowledge of any particular widget.
 */

export type WidgetTag = 'div' | 'span' | 'button'

/** Something a click on a node asks the plugin to do. */
export type WidgetAction = {
  kind: 'openJournalDay'
  /** `YYYYMMDD`, the same shape as Logseq's `journalDay`. */
  day: number
}

export interface WidgetNode {
  /** Defaults to `div`. */
  tag?: WidgetTag
  class?: string
  /** Leaf text; a node carries either `text` or `children`, never both. */
  text?: string
  title?: string
  /** `data-*` attributes, used by the stylesheet for cell states. */
  data?: Record<string, string>
  /** Inline style properties, for values the stylesheet cannot know. */
  style?: Record<string, string>
  action?: WidgetAction
  children?: WidgetNode[]
}

/** Attribute the DOM layer stores an encoded action in. */
export const ACTION_ATTRIBUTE = 'data-lsdb-action'

export function encodeAction(action: WidgetAction): string {
  return JSON.stringify(action)
}

/** Decode an action attribute, tolerating anything that is not one. */
export function decodeAction(raw: unknown): WidgetAction | null {
  if (typeof raw !== 'string' || raw === '') return null
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  if (typeof parsed !== 'object' || parsed === null) return null

  const { kind, day } = parsed as Record<string, unknown>
  if (kind !== 'openJournalDay') return null
  if (typeof day !== 'number' || !Number.isInteger(day) || day <= 0) return null
  return { kind, day }
}
