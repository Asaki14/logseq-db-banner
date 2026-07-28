import '@logseq/libs'
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
import { settingsGroups, toSettingsSchema } from './fields'
import {
  classifyGraph,
  createGraphGate,
  type DecidedGraphSupport,
} from './graph'
import { openJournalDay, widgetHost } from './host'
import { journalViewKey, toHostView, type HostView } from './journal'
import {
  closeSettingsPanel,
  toggleSettingsPanel,
  TOOLBAR_ACTION,
  type SettingsValue,
} from './panel'
import type { WeekStart } from './progress'
import { createRefresher } from './refresh'
import { createQuoteRotation } from './rotation'
import {
  DEFAULT_BANNER_HEIGHT,
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
  type WallpaperSource,
} from './settings'
import { bannerStyles, settingsPanelStyles } from './styles'
import {
  buildWidgetViews,
  widgetDataRequests,
  widgetDefinitions,
  type WidgetContext,
} from './widgets'

const TICK_INTERVAL_MS = 1000
/** How often the graph is re-asked about while it is still loading. */
const GRAPH_PROBE_INTERVAL_MS = 500
/** How long a burst of graph transactions has to pause before data is re-read. */
const GRAPH_CHANGE_DELAY_MS = 300
/** …and how long an unbroken burst — someone typing — may hold that off. */
const GRAPH_CHANGE_MAX_DELAY_MS = 1500

const widgetIds = widgetDefinitions.map(({ id }) => id)

// Still registered, so Logseq's own settings pane keeps working as the fallback
// for the popover — both are generated from `settingsGroups`.
logseq.useSettingsSchema(toSettingsSchema(settingsGroups))

interface BannerConfig {
  appearance: Omit<BannerAppearance, 'wallpaperUrl'>
  wallpaperSource: WallpaperSource
  birthDate: Date | null
  lifespanYears: number
  weekStart: WeekStart
  quoteTag: string
  visibleWidgets: Set<string>
}

/**
 * Everything this plugin has written to its own settings this session. A plugin
 * cannot see its own `logseq.updateSettings` — `logseq.settings` still holds the
 * old value when the promise resolves, and no settings-changed event fires — so
 * the patch has to be kept and merged in until the host re-reads the file, which
 * is exactly what a settings-changed event announces.
 */
let ownWrites: Record<string, unknown> = {}

/** The stored settings as this plugin sees them: the host's plus its own writes. */
function settingsSnapshot(): Record<string, unknown> {
  return { ...((logseq.settings ?? {}) as Record<string, unknown>), ...ownWrites }
}

function readConfig(overrides: Record<string, unknown> = {}): BannerConfig {
  ownWrites = { ...ownWrites, ...overrides }
  const settings = settingsSnapshot()

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
/** The journal view on screen, or `null` when the banner does not belong here. */
let journalKey: string | null = null
/** Holds the quote for as long as the user stays on one journal view. */
const quoteRotation = createQuoteRotation()

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
  journalKey = journalViewKey(await readHostView())
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
    quoteForVisit: (quotes) => quoteRotation.current(quotes),
  }
}

function tick(): void {
  // Re-asked every tick so a missed route event, or a route event that fired
  // before the page state settled, self-heals within a second.
  void mountDecision.refresh()
  // Arriving on another journal view is what rotates the quote. It is read off
  // the view's identity rather than the route event, because Logseq fires that
  // event twice per navigation — and because a missed event still rotates once
  // the mount decision catches up.
  quoteRotation.observe(journalKey)
  if (journalKey === null) {
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

/**
 * Wait for a graph to load before ruling on it: a cold start answers "not a DB
 * graph" for the milliseconds before the graph arrives, and taking that as
 * final killed the plugin for the session on a DB graph. `onCurrentGraphChanged`
 * is not enough on its own — a graph already loading when the plugin starts may
 * never fire it — so the gate is also re-asked on an interval until it decides.
 */
async function awaitGraphSupport(): Promise<DecidedGraphSupport> {
  const gate = createGraphGate(async () => {
    const [graph, isDbGraph] = await Promise.all([
      logseq.App.getCurrentGraph(),
      logseq.App.checkCurrentIsDbGraph(),
    ])
    // Typed `Boolean`, but the bridge serialises a primitive.
    return classifyGraph(graph, Boolean(isDbGraph))
  })

  const timer = window.setInterval(gate.recheck, GRAPH_PROBE_INTERVAL_MS)
  logseq.App.onCurrentGraphChanged(() => gate.recheck())
  gate.recheck()

  try {
    return await gate.decided
  } finally {
    window.clearInterval(timer)
  }
}

/**
 * Apply one edit from the popover: persist it, and fold it into this session's
 * config straight away — `logseq.settings` will not carry it and no
 * settings-changed event fires for a plugin's own write, so the banner would
 * otherwise not move until a restart.
 */
function applySetting(key: string, value: SettingsValue): void {
  void logseq.updateSettings({ [key]: value })
  config = readConfig({ [key]: value })
  appliedAppearanceKey = ''
  invalidateWidgetData()
  tick()
}

/**
 * Put an icon in the toolbar's plugin area, which the user pins through the
 * toolbar's plugins popover. It opens the plugin's own settings popover; Logseq's
 * generated pane stays reachable from that popover's footer and from the plugin
 * list.
 *
 * `registerUIItem('toolbar', …)` takes a template string rendered in the host
 * document, so the click cannot be a listener: `data-on-click` names a method on
 * `provideModel`, and the icon is inline SVG rather than a `ti ti-*` class so it
 * does not depend on the host's icon font being loaded.
 */
function registerToolbarButton(): void {
  logseq.provideModel({
    [TOOLBAR_ACTION]() {
      toggleSettingsPanel({
        groups: settingsGroups,
        readValue: (key) => settingsSnapshot()[key],
        onChange: applySetting,
        onOpenNativeSettings: () => logseq.showSettingsUI(),
      })
    },
  })

  logseq.App.registerUIItem('toolbar', {
    // The toolbar's plugins popover labels the entry with this key verbatim, so it
    // is the plugin's name rather than a description of what the click does.
    key: 'DB-Banner',
    template: `
      <a class="button" data-on-click="${TOOLBAR_ACTION}" title="DB Banner settings">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"
             fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
             stroke-linejoin="round">
          <rect x="4" y="4" width="16" height="16" rx="3"></rect>
          <circle cx="15" cy="9" r="1"></circle>
          <path d="M4 15l4 -4a3 5 0 0 1 3 0l5 5"></path>
          <path d="M14 14l1 -1a3 5 0 0 1 3 0l2 2"></path>
        </svg>
      </a>
    `,
  })
}

async function main(): Promise<void> {
  if ((await awaitGraphSupport()) === 'file') {
    await logseq.UI.showMsg(
      'DB Banner only supports Logseq DB graphs.',
      'warning',
    )
    return
  }

  config = readConfig(await migrateSettings())

  logseq.provideStyle(bannerStyles)
  logseq.provideStyle(settingsPanelStyles)
  setWidgetActionHandler((action) => {
    // The day the click opens may be the one the calendar is about to mark, so
    // the journal reads are dropped rather than waiting out their TTL.
    invalidateWidgetData()
    void openJournalDay(action.day)
  })
  registerToolbarButton()
  // A reload leaves the previous instance's banner — and any open popover, whose
  // listeners died with its iframe — in the host document; start from a clean one
  // rather than adopting DOM this instance never built.
  removeBanner()
  closeSettingsPanel()
  await mountDecision.refresh()
  tick()
  const timer = window.setInterval(tick, TICK_INTERVAL_MS)

  const removeSettingsListener = logseq.onSettingsChanged(() => {
    // Only an outside change gets here — a plugin's own write raises no event —
    // so the host has just re-read the file, this session's writes included, and
    // holding on to them could override what the user changed elsewhere.
    ownWrites = {}
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
    closeSettingsPanel()
    removeBanner()
  })

  console.info('[db-banner] Ready')
}

logseq.ready(main).catch((error) => {
  console.error('[db-banner] Failed to start', error)
})
