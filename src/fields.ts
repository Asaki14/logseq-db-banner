/**
 * The settings a user can change, described once. Two surfaces read this list:
 * Logseq's own schema pane (`toSettingsSchema`, handed to `useSettingsSchema`)
 * and the plugin's own popover (`panel.ts`). Keeping one list is what stops the
 * two from drifting — a new setting is a row here, nothing else.
 *
 * Nothing here touches the Logseq runtime, so it is unit tested.
 */

import type { SettingSchemaDesc } from '@logseq/libs/dist/LSPlugin'
import {
  DEFAULT_BANNER_HEIGHT,
  DEFAULT_LIFESPAN_YEARS,
  DEFAULT_QUOTE_TAG,
  DEFAULT_WALLPAPER_POSITION,
  parseBirthDate,
  parseCssLength,
  parseWallpaperPosition,
  widgetVisibilityKey,
} from './settings'
import { widgetDefinitions } from './widgets'

export type SettingsFieldKind = 'text' | 'number' | 'select' | 'toggle'

export interface SettingsField {
  key: string
  kind: SettingsFieldKind
  /** Bilingual title for the schema pane, where there is room for a sentence. */
  title: string
  /** Short bilingual label for the popover row. */
  label: string
  /** The schema pane's help text; the popover carries it as a tooltip. */
  description: string
  default: string | number | boolean
  /** `select` only: the allowed values. */
  choices?: readonly string[]
  /** `select` only: how the schema pane renders the choice. */
  picker?: 'radio' | 'select'
  /** `text` only. */
  placeholder?: string
  /**
   * Whether a non-empty raw value means anything. A value that fails this is
   * silently replaced by the default at read time, so the popover marks the
   * input instead of letting the change look applied.
   */
  isValid?: (raw: string) => boolean
}

export interface SettingsGroup {
  /** Key of the schema pane's heading entry. */
  key: string
  title: string
  fields: SettingsField[]
}

/**
 * Lift a check over the empty string: an empty field means "unset", which every
 * setting accepts — it is a non-empty value the parser throws away that the
 * popover has to point at.
 */
function unlessEmpty(isValid: (raw: string) => boolean) {
  return (raw: string): boolean => raw.trim() === '' || isValid(raw.trim())
}

export const settingsGroups: SettingsGroup[] = [
  {
    key: 'wallpaperHeading',
    title: '🖼 Wallpaper / 壁纸',
    fields: [
      {
        key: 'wallpaperSource',
        kind: 'text',
        title: 'Wallpaper source / 壁纸来源',
        label: 'Wallpaper / 壁纸',
        description:
          'An absolute local path (`/Users/me/Pictures/wall.jpg`), an `https://` URL, or a path relative to the graph assets folder. Leave empty for the gradient fallback. / 本机绝对路径、`https://` 链接，或相对于图谱 assets 目录的路径；留空则使用渐变兜底。',
        default: '',
        placeholder: '/Users/me/Pictures/wall.jpg',
      },
      {
        key: 'wallpaperFit',
        kind: 'select',
        title: 'Wallpaper fit / 填充方式',
        label: 'Fit / 填充方式',
        description: 'How the image fills the banner. / 图片如何填充横幅。',
        default: 'cover',
        choices: ['cover', 'contain', 'tile'],
        picker: 'radio',
      },
      {
        key: 'wallpaperPosition',
        kind: 'text',
        title: 'Wallpaper position / 图片位置',
        label: 'Position / 图片位置',
        description:
          'CSS background-position, for example `50% 50%` or `center top`. / CSS background-position，例如 `50% 50%` 或 `center top`。',
        default: DEFAULT_WALLPAPER_POSITION,
        placeholder: DEFAULT_WALLPAPER_POSITION,
        isValid: unlessEmpty((raw) => parseWallpaperPosition(raw, '') !== ''),
      },
      {
        key: 'bannerHeight',
        kind: 'text',
        title: 'Banner height / 横幅高度',
        label: 'Height / 横幅高度',
        description: 'A CSS length such as `220px` or `24vh`. / CSS 长度，例如 `220px`、`24vh`。',
        default: DEFAULT_BANNER_HEIGHT,
        placeholder: DEFAULT_BANNER_HEIGHT,
        isValid: unlessEmpty((raw) => parseCssLength(raw, '') !== ''),
      },
    ],
  },
  {
    key: 'progressHeading',
    title: '⏳ Time progress / 时间进度',
    fields: [
      {
        key: 'birthDate',
        kind: 'text',
        title: 'Birth date / 出生日期',
        label: 'Birth date / 出生日期',
        description:
          '`YYYY-MM-DD`. Required by the life-progress widget. / `YYYY-MM-DD`，人生进度组件需要它。',
        default: '',
        placeholder: 'YYYY-MM-DD',
        isValid: unlessEmpty((raw) => parseBirthDate(raw) !== null),
      },
      {
        key: 'lifespanYears',
        kind: 'number',
        title: 'Lifespan in years / 预期寿命（年）',
        label: 'Lifespan / 预期寿命（年）',
        description: 'Used as the denominator of the life-progress bar. / 人生进度条的分母。',
        default: DEFAULT_LIFESPAN_YEARS,
      },
      {
        key: 'weekStart',
        kind: 'select',
        title: 'Week starts on / 一周起始日',
        label: 'Week starts / 一周起始日',
        description:
          'Boundary used by the week-progress widget, and the first column of the calendar. / 周进度组件的分界，同时决定日历的首列。',
        default: 'monday',
        choices: ['monday', 'sunday', 'saturday'],
        picker: 'select',
      },
    ],
  },
  {
    key: 'quoteHeading',
    title: '💬 Quote / 每日一言',
    fields: [
      {
        key: 'quoteTag',
        kind: 'text',
        title: 'Quote source tag / 语录来源标签',
        label: 'Source tag / 来源标签',
        description:
          'Blocks carrying this tag, plus the top-level blocks of every page carrying it, become the quote pool; one is picked every time you open a journal view. Use "Quote" for Logseq\'s built-in Quote node type. Leave empty to turn the widget off. / 携带该标签的块，以及携带该标签的页面的顶层块，组成语录池，每次进入日记视图挑选一条；填 “Quote” 即使用 Logseq 内置的 Quote 节点类型；留空则关闭该组件。',
        default: DEFAULT_QUOTE_TAG,
        placeholder: DEFAULT_QUOTE_TAG,
      },
    ],
  },
  {
    key: 'widgetsHeading',
    title: '🧩 Widgets / 组件显示',
    fields: widgetDefinitions.map<SettingsField>(({ id, label }) => ({
      key: widgetVisibilityKey(id),
      kind: 'toggle',
      title: `Show ${label.toLowerCase()} widget / 显示${label}组件`,
      // The popover already sits under a "Widgets" heading, so the row only has
      // to name the widget.
      label,
      description: '',
      default: true,
    })),
  },
]

/** Every field, in the order the groups declare them. */
export const settingsFields: SettingsField[] = settingsGroups.flatMap(
  ({ fields }) => fields,
)

/**
 * The schema Logseq's own settings pane renders: a heading entry per group
 * followed by its fields. Registered as before, so that pane stays a working
 * fallback for the popover.
 */
export function toSettingsSchema(
  groups: readonly SettingsGroup[] = settingsGroups,
): SettingSchemaDesc[] {
  const schema: SettingSchemaDesc[] = []
  for (const group of groups) {
    schema.push({
      key: group.key,
      title: group.title,
      description: '',
      type: 'heading',
      default: null,
    })
    for (const field of group.fields) {
      schema.push(toSchemaEntry(field))
    }
  }
  return schema
}

function toSchemaEntry(field: SettingsField): SettingSchemaDesc {
  const base = {
    key: field.key,
    title: field.title,
    description: field.description,
    default: field.default,
  }
  switch (field.kind) {
    case 'text':
      return { ...base, type: 'string' }
    case 'number':
      return { ...base, type: 'number' }
    case 'toggle':
      return { ...base, type: 'boolean' }
    case 'select':
      return {
        ...base,
        type: 'enum',
        enumPicker: field.picker ?? 'select',
        enumChoices: [...(field.choices ?? [])],
      }
  }
}
