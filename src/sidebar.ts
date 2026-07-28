/**
 * The right sidebar panel.
 *
 * Logseq 2.0.1's right sidebar carries a `:plugin` item type whose body is
 * resolved through `plugin-handler/resolve-hosted-render pid key :sidebar`, and a
 * registered sidebar renderer is what puts the entry in the sidebar's own
 * "cube-plus" dropdown (`plugin-renderer-menu-items`, `right_sidebar.cljs`).
 * The registration API is `logseq.Experiments.registerSidebarRenderer`, which
 * prefixes the key with `_sidebar.` and sets `type: 'sidebar'` before handing the
 * descriptor to `registerHostedRenderer` — @logseq/libs 0.2.11 does not have that
 * wrapper yet, so `SIDEBAR_RENDERER_KEY` and the type are written out here and the
 * host method is invoked directly. It is an `Experiments` API: unlike the banner
 * itself there is no supported alternative, because a plugin cannot reach the
 * sidebar's item list any other way.
 *
 * The host renders `(render opts)` as a child of its own React tree, so `render`
 * has to return a host React element. It returns an empty shell and nothing else:
 * the tick loop finds it by id and patches the same `WidgetNode` trees into it
 * that the banner gets, which is why the panel needs no renderer of its own.
 */

import { ROOT_CLASS, WIDGETS_CLASS } from './banner'

export const SIDEBAR_ID = 'lsdb-sidebar'
/** Key handed to the host, `_sidebar.`-prefixed the way the SDK wrapper does. */
export const SIDEBAR_RENDERER_KEY = '_sidebar.banner'
/** What the sidebar's plugin dropdown lists the panel as. */
export const SIDEBAR_TITLE = 'DB Banner'
export const SIDEBAR_SETTINGS_CLASS = 'lsdb-sidebar__settings'

/** The subset of `React.createElement` the panel shell needs. */
export type CreateElement = (
  tag: string,
  props: Record<string, unknown>,
  ...children: unknown[]
) => unknown

/**
 * The panel shell: a widgets container for the tick loop to fill, and a button
 * that opens the plugin's own settings pane — the built-in UI generated from the
 * settings schema, which is where every option of the banner is edited.
 */
export function sidebarPanelElement(
  createElement: CreateElement,
  onOpenSettings: () => void,
): unknown {
  return createElement(
    'div',
    { id: SIDEBAR_ID, className: `${ROOT_CLASS} ${SIDEBAR_ID}` },
    createElement('div', { className: WIDGETS_CLASS }),
    createElement(
      'button',
      {
        type: 'button',
        className: SIDEBAR_SETTINGS_CLASS,
        onClick: onOpenSettings,
      },
      'Banner settings / 横幅设置',
    ),
  )
}

/** The mounted panel, or `null` while it is not in the sidebar. */
export function findSidebarPanel(doc: Document): HTMLElement | null {
  return doc.getElementById(SIDEBAR_ID)
}
