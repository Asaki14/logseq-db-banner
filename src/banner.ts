/**
 * DOM wiring for the banner region. Logseq's main content area lives in the host
 * document, not in the plugin iframe, so the banner element is created there and
 * re-attached whenever the app re-renders that subtree.
 *
 * Widgets arrive as `WidgetNode` trees and are patched into the DOM in place, so
 * the per-second tick writes only the attributes that actually changed and never
 * re-creates an element the host app is laying out.
 *
 * Every level of that patch is keyed — group cards by group id, widgets by widget
 * id — because a re-created element loses a click in flight: Chrome dispatches no
 * `click` at all when the node the mouse went down on is detached before mouseup,
 * so a widget appearing or disappearing must never rebuild its neighbours.
 */

import type { WallpaperFit } from './settings'
import {
  ACTION_ATTRIBUTE,
  decodeAction,
  encodeAction,
  type WidgetAction,
  type WidgetNode,
} from './view'
import type { WidgetView } from './widgets'

export const BANNER_ID = 'lsdb-banner'
/**
 * Marks a surface the widget styles apply to. The banner is one; the right
 * sidebar panel is the other, and both carry it so the card, widget and calendar
 * rules are written once instead of per mount point.
 */
export const ROOT_CLASS = 'lsdb-root'
/** The element inside a root that widget cards are reconciled into. */
export const WIDGETS_CLASS = 'lsdb-banner__widgets'
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

interface RenderedElements {
  /** Widget roots by id, so a tick can patch instead of rebuilding. */
  widgets: Map<string, HTMLElement>
  /** Group cards by group id, keyed for the same reason. */
  groups: Map<string, HTMLElement>
}

/**
 * One registry per mount point. The banner and the sidebar panel render the same
 * widget ids, so a single shared registry would hand the same element to both and
 * make each render move it out of the other.
 */
const renderedElements = new WeakMap<HTMLElement, RenderedElements>()

function elementsFor(root: HTMLElement): RenderedElements {
  const existing = renderedElements.get(root)
  if (existing) return existing

  const created: RenderedElements = { widgets: new Map(), groups: new Map() }
  renderedElements.set(root, created)
  return created
}

let actionHandler: ((action: WidgetAction) => void) | null = null

/**
 * Register what a click on an actionable widget node does. Clicks are delegated
 * from the widgets container, so widgets need no listeners of their own and a
 * re-render cannot leak one.
 */
export function setWidgetActionHandler(
  handler: (action: WidgetAction) => void,
): void {
  actionHandler = handler
}

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
    // A banner left behind by a previous plugin instance carries that instance's
    // click listener, which died with its iframe. Re-adding ours is a no-op when
    // it is already attached, and revives clicks when it is not.
    const widgets = existing.querySelector(`.${WIDGETS_CLASS}`)
    widgets?.removeEventListener('click', onWidgetClick)
    widgets?.addEventListener('click', onWidgetClick)
    return existing
  }

  const banner = doc.createElement('div')
  banner.id = BANNER_ID
  banner.classList.add(ROOT_CLASS, 'lsdb-banner--fallback')

  const image = doc.createElement('div')
  image.className = 'lsdb-banner__image'
  const widgets = doc.createElement('div')
  widgets.className = WIDGETS_CLASS
  widgets.addEventListener('click', onWidgetClick)

  banner.append(image, widgets)
  anchor.prepend(banner)
  return banner
}

export function removeBanner(doc = getHostDocument()): void {
  doc.getElementById(BANNER_ID)?.remove()
}

/**
 * Delegate widget clicks from a container the plugin did not create itself — the
 * sidebar panel, whose DOM the host app renders. Re-adding is a no-op when the
 * listener is already attached.
 */
export function listenForWidgetClicks(container: HTMLElement): void {
  container.removeEventListener('click', onWidgetClick)
  container.addEventListener('click', onWidgetClick)
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
  root: HTMLElement,
  views: WidgetView[],
  doc = getHostDocument(),
): void {
  const container = root.querySelector<HTMLElement>(`.${WIDGETS_CLASS}`)
  if (!container) return

  const { widgets: widgetElements, groups: groupElements } = elementsFor(root)
  const groups = groupViews(views)
  reconcile(container, groups.map(({ group }) => group), groupElements, (group) => {
    const card = doc.createElement('div')
    card.className = `lsdb-card lsdb-card--${group}`
    return card
  })

  for (const { group, views: members } of groups) {
    const card = groupElements.get(group)
    if (!card) continue
    reconcile(card, members.map(({ id }) => id), widgetElements, (_id, index) =>
      createElement(members[index].node, doc),
    )
    for (const view of members) {
      const element = widgetElements.get(view.id)
      if (!element || patchElement(element, view.node, doc)) continue

      // A shape the patch could not reach (a different tag): swap the widget.
      const replacement = createElement(view.node, doc)
      element.replaceWith(replacement)
      widgetElements.set(view.id, replacement)
    }
  }

  container.dataset.widgetIds = views.map(({ id }) => id).join(',')
}

/** Views by group, groups in the order the registry first mentions them. */
function groupViews(
  views: WidgetView[],
): { group: string; views: WidgetView[] }[] {
  const groups: { group: string; views: WidgetView[] }[] = []
  for (const view of views) {
    const existing = groups.find(({ group }) => group === view.group)
    if (existing) existing.views.push(view)
    else groups.push({ group: view.group, views: [view] })
  }
  return groups
}

/**
 * Bring `parent`'s children in line with `keys`, reusing the element already
 * registered for a key. Only elements whose key is gone are removed and only
 * elements out of position are moved, so a key that stays keeps its element —
 * and with it any click the user has already started on it.
 */
function reconcile(
  parent: HTMLElement,
  keys: string[],
  registry: Map<string, HTMLElement>,
  create: (key: string, index: number) => HTMLElement,
): void {
  const wanted = new Set(keys)
  for (const child of [...parent.children]) {
    const key = (child as HTMLElement).dataset.reconcileKey
    if (key !== undefined && wanted.has(key)) {
      // A container the plugin did not build itself — the sidebar panel, or a
      // banner left by a previous instance — can already hold keyed children this
      // registry has never seen. Adopting them is what keeps a second pass from
      // building a duplicate beside each one.
      if (!registry.has(key)) registry.set(key, child as HTMLElement)
      continue
    }
    child.remove()
    if (key !== undefined) registry.delete(key)
  }

  keys.forEach((key, index) => {
    let element = registry.get(key)
    if (!element) {
      element = create(key, index)
      element.dataset.reconcileKey = key
      registry.set(key, element)
    }
    const atIndex = parent.children[index]
    if (atIndex !== element) parent.insertBefore(element, atIndex ?? null)
  })
}

/**
 * `instanceof` is not used on anything from the host document: these nodes come
 * from `window.parent`, so they are instances of *that* realm's constructors and
 * every `instanceof Element` check inside the plugin iframe would be false.
 */
function onWidgetClick(event: Event): void {
  const target = event.target as Element | null
  if (typeof target?.closest !== 'function') return

  const actionable = target.closest(`[${ACTION_ATTRIBUTE}]`)
  const action = decodeAction(actionable?.getAttribute(ACTION_ATTRIBUTE))
  if (!action) return

  event.preventDefault()
  event.stopPropagation()
  actionHandler?.(action)
}

function createElement(node: WidgetNode, doc: Document): HTMLElement {
  const element = doc.createElement(node.tag ?? 'div')
  // Keeps a calendar day from submitting anything it may end up nested in.
  if (node.tag === 'button') element.setAttribute('type', 'button')
  patchElement(element, node, doc)
  return element
}

/**
 * Bring `element` in line with `node`, writing only what differs. Returns `false`
 * when the element cannot represent the node at all, which is the caller's cue to
 * replace it.
 */
function patchElement(
  element: HTMLElement,
  node: WidgetNode,
  doc: Document,
): boolean {
  if (element.tagName !== (node.tag ?? 'div').toUpperCase()) return false

  const className = node.class ?? ''
  if (element.className !== className) element.className = className

  const title = node.title ?? ''
  if (element.title !== title) element.title = title

  patchDataset(element, node)
  patchStyle(element, node)

  const action = node.action ? encodeAction(node.action) : null
  if (action === null) {
    element.removeAttribute(ACTION_ATTRIBUTE)
  } else if (element.getAttribute(ACTION_ATTRIBUTE) !== action) {
    element.setAttribute(ACTION_ATTRIBUTE, action)
  }

  const children = node.children ?? []
  if (children.length === 0) {
    const text = node.text ?? ''
    if (element.textContent !== text) element.textContent = text
    return true
  }

  if (element.childElementCount !== children.length) {
    element.replaceChildren(
      ...children.map((child) => createElement(child, doc)),
    )
    return true
  }
  children.forEach((child, index) => {
    const existing = element.children[index] as HTMLElement
    if (patchElement(existing, child, doc)) return
    existing.replaceWith(createElement(child, doc))
  })
  return true
}

/** Dataset keys the renderer owns; they are not part of any `node.data`. */
const RESERVED_DATA_KEYS = new Set(['lsdbAction', 'reconcileKey'])

function patchDataset(element: HTMLElement, node: WidgetNode): void {
  const data = node.data ?? {}
  for (const key of Object.keys(element.dataset)) {
    if (!RESERVED_DATA_KEYS.has(key) && !(key in data)) {
      delete element.dataset[key]
    }
  }
  for (const [key, value] of Object.entries(data)) {
    if (element.dataset[key] !== value) element.dataset[key] = value
  }
}

function patchStyle(element: HTMLElement, node: WidgetNode): void {
  const style = node.style ?? {}
  for (const [property, value] of Object.entries(style)) {
    if (element.style.getPropertyValue(property) !== value) {
      element.style.setProperty(property, value)
    }
  }
  for (const property of [...element.style]) {
    if (!(property in style)) element.style.removeProperty(property)
  }
}
