// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest'

import { ROOT_CLASS, WIDGETS_CLASS } from './banner'
import {
  findSidebarPanel,
  sidebarPanelElement,
  SIDEBAR_ID,
  SIDEBAR_RENDERER_KEY,
  SIDEBAR_SETTINGS_CLASS,
} from './sidebar'

/** Stands in for the host's `React.createElement`. */
interface Element {
  tag: string
  props: Record<string, unknown>
  children: unknown[]
}

const createElement = (
  tag: string,
  props: Record<string, unknown>,
  ...children: unknown[]
): Element => ({ tag, props, children })

describe('sidebarPanelElement', () => {
  it('is a shell the tick loop can find and render into', () => {
    const panel = sidebarPanelElement(createElement, () => {}) as Element

    expect(panel.props.id).toBe(SIDEBAR_ID)
    // Both surfaces wear the root class, so the card and widget rules are
    // written once rather than per mount point.
    expect(String(panel.props.className).split(' ')).toContain(ROOT_CLASS)

    const widgets = panel.children.find(
      (child) => (child as Element).props.className === WIDGETS_CLASS,
    )
    expect(widgets).toBeDefined()
    // Empty: the widgets themselves are patched in as host DOM, not as React
    // children, so React has nothing of ours to overwrite on a re-render.
    expect((widgets as Element).children).toEqual([])
  })

  it('offers the settings pane, which is the whole configuration UI', () => {
    const onOpenSettings = vi.fn()
    const panel = sidebarPanelElement(createElement, onOpenSettings) as Element

    const button = panel.children.find(
      (child) => (child as Element).props.className === SIDEBAR_SETTINGS_CLASS,
    ) as Element
    expect(button.tag).toBe('button')
    // Keeps the button from submitting anything the host may nest it in.
    expect(button.props.type).toBe('button')

    ;(button.props.onClick as () => void)()
    expect(onOpenSettings).toHaveBeenCalledOnce()
  })

  it('names the renderer the way the host resolves a sidebar one', () => {
    // `resolve-hosted-render` matches on the `_sidebar.`-prefixed key, which is
    // what `logseq.Experiments.registerSidebarRenderer` writes for a plugin.
    expect(SIDEBAR_RENDERER_KEY).toMatch(/^_sidebar\./)
  })
})

describe('findSidebarPanel', () => {
  it('reports the panel only while the host has it mounted', () => {
    const doc = document.implementation.createHTMLDocument('host')
    expect(findSidebarPanel(doc)).toBeNull()

    const panel = doc.createElement('div')
    panel.id = SIDEBAR_ID
    doc.body.append(panel)
    expect(findSidebarPanel(doc)).toBe(panel)
  })
})
