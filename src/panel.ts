/**
 * The plugin's own settings popover. Like the banner it is built in the *host*
 * document (`window.parent.document`, reachable because the manifest carries
 * root-level `effect: true`), which is what lets it carry real listeners: a
 * `registerUIItem` template can only name a `provideModel` method, so an input
 * event has nowhere to land there.
 *
 * It is rebuilt from scratch on every open — values are read once, at that
 * moment — so there is no reconciliation to get wrong and no state to go stale.
 * Nothing in here re-renders while it is open, so a click can never be eaten by
 * a rebuild the way the banner's would be.
 */

import type { SettingsField, SettingsGroup } from './fields'

export const SETTINGS_PANEL_ID = 'lsdb-settings'
/**
 * The toolbar item's `data-on-click` method, which is also the only reliable
 * handle on the item: the host renders the same template twice (toolbar strip and
 * plugins popover), each as `#<plugin-id>--<key>`, and the plugin id differs
 * between a dot-root install and a dev registration.
 */
export const TOOLBAR_ACTION = 'openBannerSettings'
const ANCHOR_SELECTOR = `[data-on-click="${TOOLBAR_ACTION}"]`
/** Gap between the toolbar icon and the popover, and from the viewport edge. */
const ANCHOR_GAP = 8
const PANEL_WIDTH = 340

export type SettingsValue = string | number | boolean

export interface SettingsPanelOptions {
  groups: readonly SettingsGroup[]
  /** The stored value of a setting, or `undefined` when it has none. */
  readValue(key: string): unknown
  /** Persist and apply one edit. */
  onChange(key: string, value: SettingsValue): void
  /** Footer escape hatch to Logseq's own schema pane. */
  onOpenNativeSettings(): void
  doc?: Document
}

function hostDocument(): Document {
  return window.parent.document
}

export function isSettingsPanelOpen(doc = hostDocument()): boolean {
  return doc.getElementById(SETTINGS_PANEL_ID) !== null
}

export function closeSettingsPanel(doc = hostDocument()): void {
  const panel = doc.getElementById(SETTINGS_PANEL_ID)
  if (!panel) return
  panel.remove()
  doc.removeEventListener('mousedown', onOutsideMouseDown, true)
  doc.removeEventListener('keydown', onKeyDown, true)
}

/** Opens the popover, or closes it when the same icon is clicked again. */
export function toggleSettingsPanel(options: SettingsPanelOptions): void {
  const doc = options.doc ?? hostDocument()
  if (isSettingsPanelOpen(doc)) {
    closeSettingsPanel(doc)
    return
  }
  openSettingsPanel(options)
}

export function openSettingsPanel(options: SettingsPanelOptions): void {
  const doc = options.doc ?? hostDocument()
  closeSettingsPanel(doc)

  const panel = doc.createElement('div')
  panel.id = SETTINGS_PANEL_ID
  panel.setAttribute('role', 'dialog')
  panel.setAttribute('aria-label', 'DB Banner settings')
  panel.append(
    buildHead(doc),
    buildBody(doc, options),
    buildFoot(doc, options),
  )

  doc.body.append(panel)
  position(panel, doc)
  doc.addEventListener('mousedown', onOutsideMouseDown, true)
  doc.addEventListener('keydown', onKeyDown, true)
}

function buildHead(doc: Document): HTMLElement {
  const head = doc.createElement('div')
  head.className = 'lsdb-settings__head'

  const title = doc.createElement('span')
  title.className = 'lsdb-settings__title'
  title.textContent = 'DB Banner'

  const close = doc.createElement('button')
  close.type = 'button'
  close.className = 'lsdb-settings__close'
  close.setAttribute('aria-label', 'Close')
  close.textContent = '✕'
  close.addEventListener('click', () => closeSettingsPanel(doc))

  head.append(title, close)
  return head
}

function buildBody(doc: Document, options: SettingsPanelOptions): HTMLElement {
  const body = doc.createElement('div')
  body.className = 'lsdb-settings__body'

  for (const group of options.groups) {
    const section = doc.createElement('section')
    section.className = 'lsdb-settings__group'
    section.dataset.group = group.key

    const heading = doc.createElement('div')
    heading.className = 'lsdb-settings__heading'
    heading.textContent = group.title
    section.append(heading)

    for (const field of group.fields) {
      section.append(buildRow(doc, field, options))
    }
    body.append(section)
  }
  return body
}

function buildFoot(doc: Document, options: SettingsPanelOptions): HTMLElement {
  const foot = doc.createElement('div')
  foot.className = 'lsdb-settings__foot'

  const native = doc.createElement('button')
  native.type = 'button'
  native.className = 'lsdb-settings__link'
  native.textContent = 'Open Logseq settings / 打开 Logseq 设置'
  native.addEventListener('click', () => {
    closeSettingsPanel(doc)
    options.onOpenNativeSettings()
  })

  foot.append(native)
  return foot
}

function buildRow(
  doc: Document,
  field: SettingsField,
  options: SettingsPanelOptions,
): HTMLElement {
  const row = doc.createElement('label')
  row.className = `lsdb-settings__row lsdb-settings__row--${field.kind}`
  row.dataset.key = field.key
  // The schema pane's help text, which there is no room for inline.
  if (field.description) row.title = field.description

  const label = doc.createElement('span')
  label.className = 'lsdb-settings__label'
  label.textContent = field.label

  row.append(label, buildControl(doc, field, options))
  return row
}

function buildControl(
  doc: Document,
  field: SettingsField,
  options: SettingsPanelOptions,
): HTMLElement {
  const stored = options.readValue(field.key)

  switch (field.kind) {
    case 'toggle':
      return buildToggle(doc, field, asBoolean(stored, field), options)
    case 'select':
      return buildSelect(doc, field, asString(stored, field), options)
    case 'number':
    case 'text':
      return buildInput(doc, field, asString(stored, field), options)
  }
}

function buildToggle(
  doc: Document,
  field: SettingsField,
  checked: boolean,
  options: SettingsPanelOptions,
): HTMLElement {
  const wrapper = doc.createElement('span')
  wrapper.className = 'lsdb-settings__switch'

  const input = doc.createElement('input')
  input.type = 'checkbox'
  input.className = 'lsdb-settings__checkbox'
  input.checked = checked
  input.addEventListener('change', () => {
    options.onChange(field.key, input.checked)
  })

  const knob = doc.createElement('span')
  knob.className = 'lsdb-settings__knob'

  wrapper.append(input, knob)
  return wrapper
}

function buildSelect(
  doc: Document,
  field: SettingsField,
  value: string,
  options: SettingsPanelOptions,
): HTMLElement {
  const select = doc.createElement('select')
  select.className = 'lsdb-settings__control lsdb-settings__select'

  for (const choice of field.choices ?? []) {
    const option = doc.createElement('option')
    option.value = choice
    option.textContent = choice
    select.append(option)
  }
  select.value = value
  select.addEventListener('change', () => {
    options.onChange(field.key, select.value)
  })
  return select
}

function buildInput(
  doc: Document,
  field: SettingsField,
  value: string,
  options: SettingsPanelOptions,
): HTMLElement {
  const input = doc.createElement('input')
  input.className = 'lsdb-settings__control lsdb-settings__input'
  input.type = field.kind === 'number' ? 'number' : 'text'
  input.value = value
  if (field.placeholder) input.placeholder = field.placeholder

  const commit = (): void => {
    markValidity(input, field)
    options.onChange(field.key, readInput(input, field))
  }
  // `change` rather than `input`: a half-typed path or CSS length is not worth
  // writing to the settings file, let alone probing as a wallpaper.
  input.addEventListener('change', commit)
  markValidity(input, field)
  return input
}

/**
 * A number field cleared to nothing means "back to the default", not `NaN` —
 * which is what `Number('')` would write into the settings file.
 */
function readInput(input: HTMLInputElement, field: SettingsField): SettingsValue {
  if (field.kind !== 'number') return input.value
  const value = Number(input.value)
  return Number.isFinite(value) && input.value.trim() !== ''
    ? value
    : field.default
}

/**
 * Flag a value the parsers will throw away. Without it a typo looks applied —
 * the banner keeps the previous value and nothing says why.
 */
function markValidity(input: HTMLInputElement, field: SettingsField): void {
  const invalid = field.isValid ? !field.isValid(input.value) : false
  input.classList.toggle('lsdb-settings__control--invalid', invalid)
}

function asString(stored: unknown, field: SettingsField): string {
  if (typeof stored === 'string') return stored
  if (typeof stored === 'number' && Number.isFinite(stored)) return String(stored)
  return String(field.default)
}

function asBoolean(stored: unknown, field: SettingsField): boolean {
  if (typeof stored === 'boolean') return stored
  if (stored === 'true') return true
  if (stored === 'false') return false
  return Boolean(field.default)
}

/**
 * Hang the popover under the toolbar icon, clamped into the viewport. The icon
 * may be either of the host's two copies of the template — pinned in the toolbar
 * strip, or listed in the plugins popover — so the first one that is actually
 * laid out wins; with neither on screen the popover falls back to the top right,
 * where the toolbar is.
 */
function position(panel: HTMLElement, doc: Document): void {
  const view = doc.defaultView
  const viewportWidth = view?.innerWidth ?? PANEL_WIDTH + 2 * ANCHOR_GAP
  const anchor = [...doc.querySelectorAll(ANCHOR_SELECTOR)]
    .map((element) => element.getBoundingClientRect())
    .find((rect) => rect.width > 0 && rect.height > 0)

  const top = anchor ? anchor.bottom + ANCHOR_GAP : 44
  const right = anchor ? anchor.right : viewportWidth - ANCHOR_GAP
  const left = Math.max(
    ANCHOR_GAP,
    Math.min(right - PANEL_WIDTH, viewportWidth - PANEL_WIDTH - ANCHOR_GAP),
  )

  panel.style.top = `${Math.round(top)}px`
  panel.style.left = `${Math.round(left)}px`
}

/**
 * `instanceof` is useless on host nodes — they belong to `window.parent`'s realm
 * — so the target is duck-typed. The listener runs in the capture phase, before
 * the host's own toolbar handler, and ignores clicks on the icon so that a second
 * click toggles rather than closing and reopening.
 */
function onOutsideMouseDown(event: Event): void {
  const target = event.target as Element | null
  if (typeof target?.closest !== 'function') return
  if (target.closest(`#${SETTINGS_PANEL_ID}`)) return
  if (target.closest(ANCHOR_SELECTOR)) return
  closeSettingsPanel((target.ownerDocument ?? undefined) as Document | undefined)
}

function onKeyDown(event: Event): void {
  const key = (event as KeyboardEvent).key
  if (key !== 'Escape') return
  const target = event.target as Element | null
  closeSettingsPanel(target?.ownerDocument ?? undefined)
}
