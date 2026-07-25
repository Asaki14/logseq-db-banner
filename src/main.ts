import '@logseq/libs'
import type { SettingSchemaDesc } from '@logseq/libs/dist/LSPlugin'
import {
  applyAppearance,
  ensureBanner,
  markWallpaperLoaded,
  probeWallpaper,
  removeBanner,
  renderWidgets,
  setWidgetActionHandler,
  type BannerAppearance,
} from './banner'
import { createAsyncCache, type AsyncCache } from './cache'
import { createCoalescer } from './coalesce'
import { openJournalDay, widgetHost } from './host'
import { shouldMountBanner, toHostView, type HostView } from './journal'
import type { WeekStart } from './progress'
import { createRefresher } from './refresh'
import {
  DEFAULT_BANNER_HEIGHT,
  DEFAULT_LIFESPAN_YEARS,
  DEFAULT_QUOTE_TAG,
  DEFAULT_WALLPAPER_POSITION,
  parseBirthDate,
  parseCssLength,
  parseLifespanYears,
  parseQuoteTag,
  parseWallpaperFit,
  parseWallpaperPosition,
  parseWeekStart,
  resolveWallpaperSource,
  resolveWidgetVisibility,
  settingsMigration,
  toAssetsUrl,
  widgetVisibilityKey,
  type WallpaperSource,
} from './settings'
import { bannerStyles } from './styles'
import {
  buildWidgetViews,
  widgetDataRequests,
  widgetDefinitions,
  type WidgetContext,
} from './widgets'

const TICK_INTERVAL_MS = 1000
/** How long a burst of graph transactions has to pause before data is re-read. */
const GRAPH_CHANGE_DELAY_MS = 300
/** …and how long an unbroken burst — someone typing — may hold that off. */
const GRAPH_CHANGE_MAX_DELAY_MS = 1500

const widgetIds = widgetDefinitions.map(({ id }) => id)

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
    description:
      'Boundary used by the week-progress widget, and the first column of the calendar. / 周进度组件的分界，同时决定日历的首列。',
  },
  {
    key: 'quoteHeading',
    title: '💬 Quote / 每日一言',
    description: '',
    type: 'heading',
    default: null,
  },
  {
    key: 'quoteTag',
    type: 'string',
    default: DEFAULT_QUOTE_TAG,
    title: 'Quote source tag / 语录来源标签',
    description:
      'Blocks carrying this tag, plus the top-level blocks of every page carrying it, become the quote pool; one is picked per day. Use "Quote" for Logseq\'s built-in Quote node type. Leave empty to turn the widget off. / 携带该标签的块，以及携带该标签的页面的顶层块，组成语录池，每天挑选一条；填 “Quote” 即使用 Logseq 内置的 Quote 节点类型；留空则关闭该组件。',
  },
  {
    key: 'widgetsHeading',
    title: '🧩 Widgets / 组件显示',
    description: '',
    type: 'heading',
    default: null,
  },
  ...widgetDefinitions.map<SettingSchemaDesc>((definition) => ({
    key: widgetVisibilityKey(definition.id),
    type: 'boolean',
    default: true,
    title: `Show ${definition.label.toLowerCase()} widget / 显示${definition.label}组件`,
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
  quoteTag: string
  visibleWidgets: Set<string>
}

function readConfig(overrides: Record<string, unknown> = {}): BannerConfig {
  const settings = {
    ...((logseq.settings ?? {}) as Record<string, unknown>),
    ...overrides,
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
    quoteTag: parseQuoteTag(settings.quoteTag),
    visibleWidgets: resolveWidgetVisibility(settings, widgetIds),
  }
}

/**
 * Carry a phase 1 `show<Id>Progress` choice over to `show<Id>Widget` once, so a
 * saved configuration survives the rename. The legacy keys are left in place:
 * they cost nothing, and removing them would lose the choice for anyone who rolls
 * back to an older build.
 *
 * Returns the patch, because `logseq.settings` does not yet contain it when
 * `updateSettings` resolves, and a plugin's own write raises no settings-changed
 * event — so this run's config has to be built from the patch directly.
 */
async function migrateSettings(): Promise<Record<string, unknown>> {
  const settings = (logseq.settings ?? {}) as Record<string, unknown>
  const patch = settingsMigration(settings, widgetIds)
  if (Object.keys(patch).length === 0) return {}

  console.info('[db-banner] Migrating settings', patch)
  await logseq.updateSettings(patch)
  return patch
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
let isJournalView = false

/**
 * Ask the host where it currently is. The route name separates the journals feed
 * from `/page/:name`, and the current page's journal day separates a journal page
 * from a normal one; neither `journal?` nor `type` is present on a DB-graph page
 * entity at runtime, whatever the typings say.
 *
 * The route name is read through the path form on purpose: asking for the whole
 * `route-match` map never resolves across the plugin bridge, because the reitit
 * match it holds is not serialisable ("[deferred timeout] async call").
 */
async function readHostView(): Promise<HostView> {
  try {
    const [routeName, page] = await Promise.all([
      logseq.App.getStateFromStore<unknown>(['route-match', 'data', 'name']),
      logseq.Editor.getCurrentPage(),
    ])
    return toHostView(routeName, page)
  } catch (error) {
    console.warn('[db-banner] Could not read the current view', error)
    // Fail closed: no banner rather than a banner on the wrong page.
    return { routeName: null, page: null }
  }
}

/**
 * Every mount decision goes through this refresher, so the tick loop and the
 * route-change hook can never have two host reads in flight resolving out of
 * order and writing a stale answer.
 */
const mountDecision = createRefresher(async () => {
  isJournalView = shouldMountBanner(await readHostView())
})

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

/**
 * One cache per widget id. A widget's data is loaded at most once per cache key
 * and TTL, so the per-second tick renders from memory instead of re-querying the
 * graph; the caches are dropped on a route change and on a settings change, the
 * two moments when the answer can have changed without a key change.
 */
const widgetDataCaches = new Map<string, AsyncCache>()

function widgetDataCache(id: string): AsyncCache {
  const existing = widgetDataCaches.get(id)
  if (existing) return existing

  const cache = createAsyncCache()
  widgetDataCaches.set(id, cache)
  return cache
}

function invalidateWidgetData(): void {
  for (const cache of widgetDataCaches.values()) cache.invalidate()
}

/**
 * Writing a block is what changes the calendar's "this day has content" answer,
 * and `logseq.DB.onChanged` does reach a plugin in a DB graph (verified on 2.0.1;
 * the payload carries `blocks`, `txData` and `txMeta`). Editing fires one
 * transaction after another, so the re-read is coalesced instead of running per
 * transaction — the tick loop still never queries the graph itself.
 */
const graphChangeRefresh = createCoalescer(
  () => {
    invalidateWidgetData()
    tick()
  },
  { delayMs: GRAPH_CHANGE_DELAY_MS, maxDelayMs: GRAPH_CHANGE_MAX_DELAY_MS },
)

function widgetContext(): WidgetContext {
  return {
    now: new Date(),
    weekStart: config.weekStart,
    birthDate: config.birthDate,
    lifespanYears: config.lifespanYears,
    quoteTag: config.quoteTag,
  }
}

function tick(): void {
  // Re-asked every tick so a missed route event, or a route event that fired
  // before the page state settled, self-heals within a second.
  void mountDecision.refresh()
  if (!isJournalView) {
    removeBanner()
    return
  }

  const banner = ensureBanner()
  if (!banner) return

  // Set on creation and cleared whenever Logseq re-mounts the content area.
  if (banner.dataset.appearanceKey !== appliedAppearanceKey) {
    void refreshAppearance(banner)
  }

  const context = widgetContext()
  const isVisible = (id: string) => config.visibleWidgets.has(id)

  // Render from whatever each cache already holds, and let a load that is due
  // land in a later tick rather than blocking this one.
  const data = new Map<string, unknown>()
  for (const { id, request } of widgetDataRequests(context, isVisible)) {
    const cache = widgetDataCache(id)
    data.set(id, cache.peek(request.key))
    void cache.ensure(request.key, request.ttlMs, () => request.load(widgetHost))
  }

  renderWidgets(banner, buildWidgetViews(context, isVisible, (id) => data.get(id)))
}

async function main(): Promise<void> {
  if (!(await logseq.App.checkCurrentIsDbGraph())) {
    await logseq.UI.showMsg(
      'DB Banner only supports Logseq DB graphs.',
      'warning',
    )
    return
  }

  config = readConfig(await migrateSettings())

  logseq.provideStyle(bannerStyles)
  setWidgetActionHandler((action) => {
    // The day the click opens may be the one the calendar is about to mark, so
    // the journal reads are dropped rather than waiting out their TTL.
    invalidateWidgetData()
    void openJournalDay(action.day)
  })
  // A reload leaves the previous instance's banner in the host document; start
  // from a clean one rather than adopting DOM this instance never built.
  removeBanner()
  await mountDecision.refresh()
  tick()
  const timer = window.setInterval(tick, TICK_INTERVAL_MS)

  const removeSettingsListener = logseq.onSettingsChanged(() => {
    config = readConfig()
    appliedAppearanceKey = ''
    invalidateWidgetData()
    tick()
  })

  // The content column is replaced on navigation, so the banner is re-attached —
  // or removed, when the new route is not a journal — on the next tick; deciding
  // here avoids a visible one-second gap either way. A read that a tick started
  // before this event may predate the new route, hence `refreshAfterCurrent`.
  logseq.App.onRouteChanged(() => {
    // Journal content may have been edited on the page being left.
    invalidateWidgetData()
    void mountDecision.refreshAfterCurrent().then(tick)
  })

  logseq.DB.onChanged(() => graphChangeRefresh.schedule())

  logseq.beforeunload(async () => {
    window.clearInterval(timer)
    graphChangeRefresh.cancel()
    removeSettingsListener()
    removeBanner()
  })

  console.info('[db-banner] Ready')
}

logseq.ready(main).catch((error) => {
  console.error('[db-banner] Failed to start', error)
})
