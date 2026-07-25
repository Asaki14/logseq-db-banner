/**
 * DOM wiring for the banner region. Logseq's main content area lives in the host
 * document, not in the plugin iframe, so the banner element is created there and
 * re-attached whenever the app re-renders that subtree.
 */

import type { WallpaperFit } from './settings'
import type { WidgetView } from './widgets'

export const BANNER_ID = 'lsdb-banner'
/**
 * The banner goes inside the content column, never into `#main-content-container`
 * itself: that container is `display: flex; flex-direction: row` (it centres the
 * column, which is its only child), so a banner injected there becomes a second
 * flex item and starves the column (`flex: 1 1 0%`) down to zero width.
 */
export const HOST_ANCHOR_SELECTOR =
  '#main-content-container .cp__sidebar-main-content'

export interface BannerAppearance {
  height: string
  wallpaperUrl: string | null
  fit: WallpaperFit
  position: string
}

interface WidgetElements {
  root: HTMLElement
  percent: HTMLElement
  detail: HTMLElement
  bar: HTMLElement
}

const widgetElements = new Map<string, WidgetElements>()

export function getHostDocument(): Document {
  return window.parent.document
}

/**
 * Create the banner if absent and make sure it is still the first child of the
 * content column. Returns `null` while the anchor is not mounted yet.
 */
export function ensureBanner(doc = getHostDocument()): HTMLElement | null {
  const anchor = doc.querySelector(HOST_ANCHOR_SELECTOR)
  if (!anchor) return null

  const existing = doc.getElementById(BANNER_ID)
  if (existing) {
    if (existing.parentElement !== anchor) anchor.prepend(existing)
    return existing
  }

  const banner = doc.createElement('div')
  banner.id = BANNER_ID
  banner.classList.add('lsdb-banner--fallback')

  const image = doc.createElement('div')
  image.className = 'lsdb-banner__image'
  const widgets = doc.createElement('div')
  widgets.className = 'lsdb-banner__widgets'

  banner.append(image, widgets)
  anchor.prepend(banner)
  widgetElements.clear()
  return banner
}

export function removeBanner(doc = getHostDocument()): void {
  doc.getElementById(BANNER_ID)?.remove()
  widgetElements.clear()
}

export function applyAppearance(
  banner: HTMLElement,
  appearance: BannerAppearance,
): void {
  banner.style.setProperty('--lsdb-banner-height', appearance.height)
  banner.style.setProperty('--lsdb-wallpaper-position', appearance.position)
  banner.classList.toggle('lsdb-fit-contain', appearance.fit === 'contain')
  banner.classList.toggle('lsdb-fit-tile', appearance.fit === 'tile')

  if (appearance.wallpaperUrl) {
    banner.style.setProperty(
      '--lsdb-wallpaper',
      `url("${appearance.wallpaperUrl.replace(/"/g, '%22')}")`,
    )
  } else {
    banner.style.removeProperty('--lsdb-wallpaper')
  }
  // The fallback gradient stays on until a load probe confirms the image.
  banner.classList.add('lsdb-banner--fallback')
}

/**
 * Probe the wallpaper before trusting it. A missing file, a denied path or an
 * unreadable image all surface as a load error, and the banner keeps its
 * gradient fallback instead of rendering an empty box.
 */
export function probeWallpaper(
  url: string,
  doc = getHostDocument(),
): Promise<boolean> {
  return new Promise((resolve) => {
    const probe = doc.createElement('img')
    probe.onload = () => resolve(probe.naturalWidth > 0)
    probe.onerror = () => resolve(false)
    probe.src = url
  })
}

export function markWallpaperLoaded(
  banner: HTMLElement,
  loaded: boolean,
): void {
  banner.classList.toggle('lsdb-banner--fallback', !loaded)
}

export function renderWidgets(
  banner: HTMLElement,
  views: WidgetView[],
  doc = getHostDocument(),
): void {
  const container = banner.querySelector<HTMLElement>('.lsdb-banner__widgets')
  if (!container) return

  const wanted = views.map(({ id }) => id).join(',')
  if (container.dataset.widgetIds !== wanted) {
    container.replaceChildren()
    widgetElements.clear()
    for (const view of views) {
      container.append(createWidgetElement(view, doc))
    }
    container.dataset.widgetIds = wanted
  }

  for (const view of views) {
    const elements = widgetElements.get(view.id)
    if (!elements) continue
    elements.percent.textContent = view.percentText
    elements.detail.textContent = view.detail
    elements.bar.style.width = view.barWidth
  }
}

function createWidgetElement(view: WidgetView, doc: Document): HTMLElement {
  const root = doc.createElement('div')
  root.className = 'lsdb-widget'
  root.dataset.widget = view.id

  const head = doc.createElement('div')
  head.className = 'lsdb-widget__head'
  const label = doc.createElement('span')
  label.className = 'lsdb-widget__label'
  label.textContent = view.label
  const percent = doc.createElement('span')
  percent.className = 'lsdb-widget__percent'
  head.append(label, percent)

  const track = doc.createElement('div')
  track.className = 'lsdb-widget__track'
  const bar = doc.createElement('div')
  bar.className = 'lsdb-widget__bar'
  track.append(bar)

  const detail = doc.createElement('div')
  detail.className = 'lsdb-widget__detail'

  root.append(head, track, detail)
  widgetElements.set(view.id, { root, percent, detail, bar })
  return root
}
