// @vitest-environment jsdom

/**
 * What the popover has to hold to: it renders the same field list the schema pane
 * does, every control shows the stored value, an edit reports one key/value pair,
 * and it goes away on an outside click, on Escape and on a second click of the
 * toolbar icon — but not on a click inside itself.
 *
 * The fixture mirrors the host document: the toolbar item is the template
 * `registerUIItem` renders, so the popover's only handle on it is
 * `data-on-click`.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { settingsFields, type SettingsGroup } from './fields'
import {
  closeSettingsPanel,
  isSettingsPanelOpen,
  openSettingsPanel,
  SETTINGS_PANEL_ID,
  TOOLBAR_ACTION,
  toggleSettingsPanel,
  type SettingsPanelOptions,
} from './panel'

const HOST_MARKUP = `
  <div id="app-container">
    <div class="ui-items-container">
      <a id="logseq-db-banner--DB-Banner" class="button"
         data-on-click="${TOOLBAR_ACTION}"><svg></svg></a>
    </div>
    <div id="main-content-container"></div>
  </div>
`

const groups: SettingsGroup[] = [
  {
    key: 'wallpaperHeading',
    title: '🖼 Wallpaper / 壁纸',
    fields: settingsFields.filter(({ key }) =>
      ['wallpaperSource', 'wallpaperFit', 'bannerHeight'].includes(key),
    ),
  },
  {
    key: 'widgetsHeading',
    title: '🧩 Widgets / 组件显示',
    fields: settingsFields.filter(({ key }) => key === 'showCalendarWidget'),
  },
]

function open(
  overrides: Partial<SettingsPanelOptions> = {},
  stored: Record<string, unknown> = {},
): { onChange: ReturnType<typeof vi.fn>; onOpenNativeSettings: ReturnType<typeof vi.fn> } {
  const onChange = vi.fn()
  const onOpenNativeSettings = vi.fn()
  openSettingsPanel({
    groups,
    readValue: (key) => stored[key],
    onChange,
    onOpenNativeSettings,
    doc: document,
    ...overrides,
  })
  return { onChange, onOpenNativeSettings }
}

function panel(): HTMLElement {
  const element = document.getElementById(SETTINGS_PANEL_ID)
  if (!element) throw new Error('the panel is not open')
  return element
}

function control<T extends HTMLElement>(key: string): T {
  const element = panel().querySelector<T>(`[data-key="${key}"] .lsdb-settings__control`)
  if (!element) throw new Error(`no control for ${key}`)
  return element
}

function mouseDown(target: Element): void {
  target.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
}

beforeEach(() => {
  document.body.innerHTML = HOST_MARKUP
  closeSettingsPanel(document)
})

describe('settings panel', () => {
  it('renders one row per field, grouped under its heading', () => {
    open()

    const sections = [...panel().querySelectorAll('.lsdb-settings__group')]
    expect(sections.map((section) => (section as HTMLElement).dataset.group)).toEqual([
      'wallpaperHeading',
      'widgetsHeading',
    ])
    expect(
      [...panel().querySelectorAll('.lsdb-settings__row')].map(
        (row) => (row as HTMLElement).dataset.key,
      ),
    ).toEqual([
      'wallpaperSource',
      'wallpaperFit',
      'bannerHeight',
      'showCalendarWidget',
    ])
  })

  it('shows the stored value, and the default where there is none', () => {
    open({}, { wallpaperSource: '/pics/wall.jpg', showCalendarWidget: false })

    expect(control<HTMLInputElement>('wallpaperSource').value).toBe('/pics/wall.jpg')
    expect(control<HTMLSelectElement>('wallpaperFit').value).toBe('cover')
    expect(control<HTMLInputElement>('bannerHeight').value).toBe('280px')
    expect(
      panel().querySelector<HTMLInputElement>('.lsdb-settings__checkbox')?.checked,
    ).toBe(false)
  })

  it('reports a text edit as one key and value', () => {
    const { onChange } = open()

    const input = control<HTMLInputElement>('bannerHeight')
    input.value = '24vh'
    input.dispatchEvent(new Event('change'))

    expect(onChange).toHaveBeenCalledExactlyOnceWith('bannerHeight', '24vh')
  })

  it('reports a select and a toggle the same way', () => {
    const { onChange } = open()

    const select = control<HTMLSelectElement>('wallpaperFit')
    select.value = 'contain'
    select.dispatchEvent(new Event('change'))

    const checkbox = panel().querySelector<HTMLInputElement>(
      '.lsdb-settings__checkbox',
    )
    if (!checkbox) throw new Error('no toggle')
    checkbox.checked = false
    checkbox.dispatchEvent(new Event('change'))

    expect(onChange.mock.calls).toEqual([
      ['wallpaperFit', 'contain'],
      ['showCalendarWidget', false],
    ])
  })

  it('marks a value the parsers would discard, and still reports it', () => {
    const { onChange } = open()

    const input = control<HTMLInputElement>('bannerHeight')
    input.value = 'tall'
    input.dispatchEvent(new Event('change'))

    expect(input.classList.contains('lsdb-settings__control--invalid')).toBe(true)
    expect(onChange).toHaveBeenCalledWith('bannerHeight', 'tall')
  })

  it('closes on an outside click, but not on a click inside', () => {
    open()

    mouseDown(control('bannerHeight'))
    expect(isSettingsPanelOpen(document)).toBe(true)

    mouseDown(document.getElementById('main-content-container')!)
    expect(isSettingsPanelOpen(document)).toBe(false)
  })

  it('closes on Escape, and stops listening once closed', () => {
    open()

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(isSettingsPanelOpen(document)).toBe(false)

    // A second Escape must not throw on an already-removed panel.
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(isSettingsPanelOpen(document)).toBe(false)
  })

  it('toggles rather than reopening when the toolbar icon is clicked again', () => {
    const options: SettingsPanelOptions = {
      groups,
      readValue: () => undefined,
      onChange: vi.fn(),
      onOpenNativeSettings: vi.fn(),
      doc: document,
    }

    toggleSettingsPanel(options)
    expect(isSettingsPanelOpen(document)).toBe(true)

    // The host's own handler runs after the capture-phase outside-click listener,
    // which must leave the icon's own click alone for the toggle to be reached.
    mouseDown(document.querySelector(`[data-on-click="${TOOLBAR_ACTION}"]`)!)
    expect(isSettingsPanelOpen(document)).toBe(true)

    toggleSettingsPanel(options)
    expect(isSettingsPanelOpen(document)).toBe(false)
  })

  it('hands the footer link to the host settings pane', () => {
    const { onOpenNativeSettings } = open()

    panel().querySelector<HTMLElement>('.lsdb-settings__link')?.click()

    expect(onOpenNativeSettings).toHaveBeenCalledOnce()
    expect(isSettingsPanelOpen(document)).toBe(false)
  })
})
