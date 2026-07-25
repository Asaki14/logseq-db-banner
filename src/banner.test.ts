// @vitest-environment jsdom

/**
 * The layout contract behind the mount point. jsdom does no layout, so nothing
 * here measures widths; what it pins down is the structural and CSS-scoping
 * invariant that the live fix depends on:
 *
 *   `#main-content-container` is `display: flex; flex-direction: row` in Logseq
 *   2.0.1, and `.cp__sidebar-main-content` (`flex: 1 1 0%`) is its only child — the
 *   row exists to centre that column. A banner injected as a second child becomes
 *   a flex item beside the column, which then resolves to zero width. So the banner
 *   must land inside the column, and the injected CSS must not touch host elements.
 *
 * The fixture mirrors the structure measured live, right sidebar included: it is
 * `#right-sidebar` under `#app-container`, a sibling of the scroll container rather
 * than a flex item inside it, which is why opening it narrows the column from the
 * outside.
 */

import { beforeEach, describe, expect, it } from 'vitest'
import {
  BANNER_ID,
  ensureBanner,
  HOST_ANCHOR_SELECTOR,
  removeBanner,
} from './banner'
import { bannerStyles } from './styles'

const HOST_MARKUP = `
  <div id="app-container">
    <div id="main-content-container" class="scrollbar-spacing w-full flex justify-center flex-row">
      <div class="cp__sidebar-main-content">
        <div class="mx-auto pb-24"><div id="journals"></div></div>
      </div>
    </div>
    <div id="right-sidebar" class="cp__right-sidebar h-screen"></div>
  </div>
`

beforeEach(() => {
  document.body.innerHTML = HOST_MARKUP
})

describe('banner mount point', () => {
  it('mounts inside the content column, not as a child of the flex row', () => {
    const banner = ensureBanner(document)
    const column = document.querySelector('.cp__sidebar-main-content')
    const flexRow = document.querySelector('#main-content-container')

    expect(banner).not.toBeNull()
    expect(banner?.parentElement).toBe(column)
    expect(column?.firstElementChild).toBe(banner)
    expect([...(flexRow?.children ?? [])]).not.toContain(banner)
  })

  it('does not mount when the content column is absent', () => {
    document.body.innerHTML = '<div id="main-content-container"></div>'
    expect(ensureBanner(document)).toBeNull()
    expect(document.getElementById(BANNER_ID)).toBeNull()
  })

  it('reuses the existing banner and re-attaches it to the content column', () => {
    const first = ensureBanner(document)
    document.body.append(first as HTMLElement)

    const second = ensureBanner(document)
    expect(second).toBe(first)
    expect(second?.parentElement).toBe(
      document.querySelector('.cp__sidebar-main-content'),
    )
  })

  it('removes the banner from the host document', () => {
    ensureBanner(document)
    removeBanner(document)
    expect(document.getElementById(BANNER_ID)).toBeNull()
  })

  it('anchors below the flex row rather than on it', () => {
    expect(HOST_ANCHOR_SELECTOR).not.toBe('#main-content-container')
    expect(HOST_ANCHOR_SELECTOR.startsWith('#main-content-container ')).toBe(true)
  })
})

describe('injected styles', () => {
  const selectors = [
    ...bannerStyles.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/(^|\})\s*([^{}@]+)\{/g),
  ].map((match) => match[2].trim())

  it('finds the rules it is about to check', () => {
    expect(selectors.length).toBeGreaterThan(5)
  })

  it('scopes every selector to the banner, so banner-less pages are untouched', () => {
    // `provideStyle` is global to the host document; a rule that matched a host
    // container would change pages this plugin never draws on.
    for (const selector of selectors) {
      for (const part of selector.split(',')) {
        expect(part.trim()).toMatch(/^#lsdb-banner\b/)
      }
    }
  })

  it('never restyles the host layout containers', () => {
    expect(bannerStyles).not.toMatch(/#main-content-container|cp__sidebar-main-content/)
  })
})
