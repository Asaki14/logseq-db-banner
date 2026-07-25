import '@logseq/libs'
import type { SettingSchemaDesc } from '@logseq/libs/dist/LSPlugin'
import {
  applyAppearance,
  ensureBanner,
  markWallpaperLoaded,
  probeWallpaper,
  removeBanner,
  renderWidgets,
  type BannerAppearance,
} from './banner'
import type { WeekStart } from './progress'
import {
  DEFAULT_BANNER_HEIGHT,
  DEFAULT_LIFESPAN_YEARS,
  DEFAULT_WALLPAPER_POSITION,
  parseBirthDate,
  parseBoolean,
  parseCssLength,
  parseLifespanYears,
  parseWallpaperFit,
  parseWallpaperPosition,
  parseWeekStart,
  resolveWallpaperSource,
  toAssetsUrl,
  type WallpaperSource,
} from './settings'
import { bannerStyles } from './styles'
import { buildWidgetViews, widgetDefinitions } from './widgets'

const TICK_INTERVAL_MS = 1000

/** Visibility setting key for a widget id, e.g. `day` -> `showDayProgress`. */
function visibilityKey(widgetId: string): string {
  return `show${widgetId[0].toUpperCase()}${widgetId.slice(1)}Progress`
}

const settingsSchema: SettingSchemaDesc[] = [
  {
    key: 'wallpaperHeading',
    title: '🖼 Wallpaper / 壁纸',
    description: '',
    type: 'heading',
    default: null,
  },
  {
    key: 'wallpaperSource',
    type: 'string',
    default: '',
    title: 'Wallpaper source / 壁纸来源',
    description:
      'An absolute local path (`/Users/me/Pictures/wall.jpg`), an `https://` URL, or a path relative to the graph assets folder. Leave empty for the gradient fallback. / 本机绝对路径、`https://` 链接，或相对于图谱 assets 目录的路径；留空则使用渐变兜底。',
  },
  {
    key: 'wallpaperFit',
    type: 'enum',
    enumPicker: 'radio',
    enumChoices: ['cover', 'contain', 'tile'],
    default: 'cover',
    title: 'Wallpaper fit / 填充方式',
    description: 'How the image fills the banner. / 图片如何填充横幅。',
  },
  {
    key: 'wallpaperPosition',
    type: 'string',
    default: DEFAULT_WALLPAPER_POSITION,
    title: 'Wallpaper position / 图片位置',
    description:
      'CSS background-position, for example `50% 50%` or `center top`. / CSS background-position，例如 `50% 50%` 或 `center top`。',
  },
  {
    key: 'bannerHeight',
    type: 'string',
    default: DEFAULT_BANNER_HEIGHT,
    title: 'Banner height / 横幅高度',
    description: 'A CSS length such as `220px` or `24vh`. / CSS 长度，例如 `220px`、`24vh`。',
  },
  {
    key: 'progressHeading',
    title: '⏳ Time progress / 时间进度',
    description: '',
    type: 'heading',
    default: null,
  },
  {
    key: 'birthDate',
    type: 'string',
    default: '',
    title: 'Birth date / 出生日期',
    description:
      '`YYYY-MM-DD`. Required by the life-progress widget. / `YYYY-MM-DD`，人生进度组件需要它。',
  },
  {
    key: 'lifespanYears',
    type: 'number',
    default: DEFAULT_LIFESPAN_YEARS,
    title: 'Lifespan in years / 预期寿命（年）',
    description: 'Used as the denominator of the life-progress bar. / 人生进度条的分母。',
  },
  {
    key: 'weekStart',
    type: 'enum',
    enumPicker: 'select',
    enumChoices: ['monday', 'sunday', 'saturday'],
    default: 'monday',
    title: 'Week starts on / 一周起始日',
    description: 'Boundary used by the week-progress widget. / 周进度组件的分界。',
  },
  ...widgetDefinitions.map<SettingSchemaDesc>((definition) => ({
    key: visibilityKey(definition.id),
    type: 'boolean',
    default: true,
    title: `Show ${definition.label.toLowerCase()} progress / 显示${definition.label}进度`,
    description: '',
  })),
]

logseq.useSettingsSchema(settingsSchema)

interface BannerConfig {
  appearance: Omit<BannerAppearance, 'wallpaperUrl'>
  wallpaperSource: WallpaperSource
  birthDate: Date | null
  lifespanYears: number
  weekStart: WeekStart
  visibleWidgets: Set<string>
}

function readConfig(): BannerConfig {
  const settings = (logseq.settings ?? {}) as Record<string, unknown>
  const visibleWidgets = new Set<string>()
  for (const definition of widgetDefinitions) {
    if (parseBoolean(settings[visibilityKey(definition.id)])) {
      visibleWidgets.add(definition.id)
    }
  }

  return {
    appearance: {
      height: parseCssLength(settings.bannerHeight, DEFAULT_BANNER_HEIGHT),
      fit: parseWallpaperFit(settings.wallpaperFit),
      position: parseWallpaperPosition(settings.wallpaperPosition),
    },
    wallpaperSource: resolveWallpaperSource(settings.wallpaperSource),
    birthDate: parseBirthDate(settings.birthDate),
    lifespanYears: parseLifespanYears(settings.lifespanYears),
    weekStart: parseWeekStart(settings.weekStart),
    visibleWidgets,
  }
}

/**
 * Turn a validated wallpaper setting into a URL the host document can load.
 * Absolute paths go through the `assets://` scheme, which Logseq's Electron shell
 * registers as a privileged file protocol; graph-relative paths are handed to
 * `logseq.Assets.makeUrl`, which resolves them against the current graph.
 */
async function resolveWallpaperUrl(
  source: WallpaperSource,
): Promise<string | null> {
  switch (source.kind) {
    case 'none':
      return null
    case 'url':
      return source.url
    case 'localPath':
      return toAssetsUrl(source.path)
    case 'graphRelative':
      try {
        return (await logseq.Assets.makeUrl(source.path)) || null
      } catch (error) {
        console.warn('[db-banner] Could not resolve graph asset', source.path, error)
        return null
      }
  }
}

let config = readConfig()
let appliedAppearanceKey = ''
let probedWallpaperUrl: string | null = null

function appearanceKey(url: string | null): string {
  const { height, fit, position } = config.appearance
  return [height, fit, position, url ?? ''].join('|')
}

async function refreshAppearance(banner: HTMLElement): Promise<void> {
  const url = await resolveWallpaperUrl(config.wallpaperSource)
  const key = appearanceKey(url)
  if (key === appliedAppearanceKey && banner.dataset.appearanceKey === key) {
    return
  }

  applyAppearance(banner, { ...config.appearance, wallpaperUrl: url })
  appliedAppearanceKey = key
  banner.dataset.appearanceKey = key
  probedWallpaperUrl = url

  if (!url) return
  const loaded = await probeWallpaper(url)
  // A later settings change may have replaced the wallpaper while probing.
  if (probedWallpaperUrl === url) markWallpaperLoaded(banner, loaded)
  if (!loaded) {
    console.warn('[db-banner] Wallpaper could not be loaded, using fallback:', url)
  }
}

function tick(): void {
  const banner = ensureBanner()
  if (!banner) return

  // Set on creation and cleared whenever Logseq re-mounts the content area.
  if (banner.dataset.appearanceKey !== appliedAppearanceKey) {
    void refreshAppearance(banner)
  }

  const views = buildWidgetViews(
    {
      now: new Date(),
      weekStart: config.weekStart,
      birthDate: config.birthDate,
      lifespanYears: config.lifespanYears,
    },
    (id) => config.visibleWidgets.has(id),
  )
  renderWidgets(banner, views)
}

async function main(): Promise<void> {
  if (!(await logseq.App.checkCurrentIsDbGraph())) {
    await logseq.UI.showMsg(
      'DB Banner only supports Logseq DB graphs.',
      'warning',
    )
    return
  }

  logseq.provideStyle(bannerStyles)
  tick()
  const timer = window.setInterval(tick, TICK_INTERVAL_MS)

  const removeSettingsListener = logseq.onSettingsChanged(() => {
    config = readConfig()
    appliedAppearanceKey = ''
    tick()
  })

  // The main content area is replaced on navigation, so the banner is re-attached
  // on the next tick; nudging it here avoids a visible one-second gap.
  logseq.App.onRouteChanged(() => {
    tick()
  })

  logseq.beforeunload(async () => {
    window.clearInterval(timer)
    removeSettingsListener()
    removeBanner()
  })

  console.info('[db-banner] Ready')
}

logseq.ready(main).catch((error) => {
  console.error('[db-banner] Failed to start', error)
})
