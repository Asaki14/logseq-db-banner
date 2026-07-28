# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- A right sidebar panel carrying the same widgets as the banner, registered through
  `logseq.Experiments.registerSidebarRenderer` and opened from the sidebar's plugin
  dropdown. It follows the app's light/dark theme, stacks its cards in one column, and
  offers a button that opens the plugin's settings pane.

## [0.2.2] - 2026-07-26

### Fixed

- The banner now renders when the plugin is **installed** — from the marketplace or
  by unzipping a release into `~/.logseq/plugins/` — which it never did in 0.2.1.
  Logseq reads `effect` from the *root* of `package.json`, not from the `logseq`
  object, so the `"effect": false` declared there was never seen and an installed
  plugin was served from `lsp://logseq.io`, cross-origin to the host page on
  `lsp://logseq.com`. Every `window.parent.document` access then threw
  `SecurityError`, the per-second tick swallowed it, and the user saw no banner and
  no error. `"effect": true` at the root keeps the iframe same-origin; the dead
  `logseq.effect` key is gone.
- A slow-loading graph no longer switches the plugin off for the whole session.
  `logseq.App.checkCurrentIsDbGraph()` answers `false` while the graph is still
  loading, and that answer was treated as final — intermittently killing the banner
  on a DB graph and showing a "DB graphs only" warning that was simply wrong. The
  check is now repeated, on `logseq.App.onCurrentGraphChanged` and on an interval,
  until a graph is actually loaded; the warning fires only for a real file graph.

### Changed

- The documented claim that `logseq.unsupportedGraphType: "file"` stops Logseq
  enabling the plugin on a file graph is corrected in both READMEs: the field is
  absent from Logseq 2.0.1 and from `@logseq/libs`, so the runtime check is the only
  gate.

## [0.2.1] - 2026-07-25

### Fixed

- A Windows absolute path as the wallpaper source now displays. `assets:` is a
  *standard* scheme, so Chromium folds the URL's leading slashes into its host and
  the drive letter lands there; the encoded colon the plugin used to emit
  (`assets:///D%3A/...`) makes the whole URL invalid, so no request was ever made
  and the banner kept its gradient fallback. The drive now travels as Logseq's own
  `logseq__colon` token (`assets:///D/logseq__colon/...`), which the shell's
  `assets://` handler turns back into `D:/` before reading the file. POSIX paths are
  unchanged.

### Changed

- The README is split by language: `README.md` is English only, `README.zh-CN.md`
  is Chinese only, each complete on its own and linking to the other from its first
  line, so switching language replaces the page instead of scrolling down it. Both
  reference the same committed screenshot, and the release zip carries both files.

## [0.2.0] - 2026-07-25

### Added

- Calendar widget: the current month, today highlighted, a marker dot on every day
  whose journal page already holds content, and a click that opens that day's
  journal — creating the page first when it does not exist yet, because navigating
  to a missing journal page renders a blank content column. The first column
  follows the `Week starts on` setting. The has-content query is cached per month
  and dropped on a route change, a settings change or after 60 seconds, so the
  per-second re-render never touches the graph.
- Quote widget: one quote per arrival at a journal view, picked over the blocks
  belonging to the configurable source tag (`quotes` by default). The pick is
  anchored to the arrival — the first mount, a return from another page, or a jump
  from one journal day to another — and then held for the whole visit, so neither
  the per-second re-render nor a quote-cache refresh moves it; with more than one
  candidate it never repeats the one just shown. A missing tag, an empty source or
  a failed query renders nothing at all, and a long quote is truncated and clamped
  so it cannot resize the banner.
- The quote source accepts Logseq's built-in `Quote` node type as well as a user
  tag. `Quote` is the built-in class `:logseq.class/Quote-block` — the tag a
  file-graph import puts on blocks that were written as `#quote` — and it is worn
  by the *blocks*, never by a page, so the source collects both shapes: every block
  carrying the tag at any depth, plus the top-level blocks of every page carrying
  it. Setting `Quote source tag` to `Quote` therefore needs no data migration.
- `Quote source tag` setting.
- A packaged release: pushing a `v*` tag builds the plugin and publishes a GitHub
  release with a zip of `dist/`, `package.json`, `README.md`, `LICENSE`,
  `CHANGELOG.md` and `icon.svg` attached, which is what the Logseq marketplace
  installs from.
- A screenshot of the banner on a journal page in the README.

### Changed

- Widget visibility settings are now `show<Id>Widget` rather than
  `show<Id>Progress`, since "progress" no longer fits a calendar or a quote. A
  saved phase 1 configuration is copied onto the new keys once, stamped with
  `settingsVersion: 2`, and the old keys are left in the file for a rollback.
- The widget registry is the sole place a widget is defined, including one that
  needs host data: a descriptor declares a cached async `request` and a pure
  `build` returning a node tree, and the banner renderer patches that tree into the
  host document without knowing any widget.
- The banner's height setting is a minimum rather than a fixed height, so a narrow
  content column that wraps the widget panel grows the banner instead of clipping
  it. The mount point and the column's width are unchanged.

- The banner is journal-only: it renders on the journals feed and on a single
  journal page, and is removed on every other view — normal pages, all-pages,
  settings, graph view, whiteboards and plugin pages. The decision comes from the
  host's route name plus the current page's journal day, not from the URL.

- The banner is laid out as two frosted-glass cards on the wallpaper: the month
  calendar on the left, the four progress bars stacked on the right with the quote
  at their foot. They share one type scale, one spacing
  rhythm, one corner radius and one accent — the colour that marks "today" is the
  colour that fills the bars.
- The default banner height is `360px` (was `220px`), which fits an unhurried month
  grid. It remains a minimum: a shorter setting grows the banner to what the cards
  need rather than clipping them.
- A widget descriptor now declares which card it belongs on (`group: 'calendar' |
  'panel'`, default `panel`).
- Graph-backed widget data is re-read when the graph is actually written to.
  `logseq.DB.onChanged` does reach a plugin in a DB graph, so a write invalidates
  the caches — coalesced over 300ms, and forced after 1.5s of an unbroken burst —
  instead of the answer waiting out its 60s TTL. The TTL stays as a backstop and
  the per-second tick still never queries the graph.
- Invalidating cached widget data now marks it stale instead of dropping it: the
  last value keeps rendering until its replacement lands, so no widget blinks out
  of the banner during a refresh.
- The banner takes up much less of the wallpaper. The default height is `280px`
  (was `360px`) and the two cards are sized to their own content instead of
  stretching across the column, so bare wallpaper shows above, below, between and
  to the right of them: measured on a 932px content column, the cards cover 34.7%
  of the banner's area where they used to cover 88.3%. The left-calendar /
  right-progress arrangement, the mount point and the column's width are unchanged.
- The cards are barely there: the scrim went from 58% of the theme background to
  7%, and the frost from `blur(20px)` to `blur(2px)`, so the wallpaper reads through
  them nearly untouched — a high-frequency wallpaper keeps its detail inside a card.
  What defines a card is its edge rather than its fill: the ink hairline is now
  paired with a 1px inset line in the theme's background colour and a 6px outer glow
  in the same colour, which replaces the old black drop shadow and keeps the seam
  visible on a wallpaper of any brightness. Checked in both themes against both a
  dark landscape and a bright high-frequency wallpaper. (The glyph halo this first
  shipped with is gone again — see the type entry below.)
- The progress readout shows three decimals (`41.286%`, was `41.8%`), in tabular
  figures in a fixed-width field so the last digit — which turns over about once a
  second on the day bar — cannot shift the row sideways.
- The progress widgets no longer show a remaining-time line. The bar, the label and
  the percentage stay; "12h left", "3d left" and "49.4y left" are gone, and the
  slot is reused only for the life bar's "set a birth date" hint.
- The two cards are now genuinely equal height rather than merely close: the row
  stretches its cards to the height of the taller one's content, and the progress
  card spreads its content over that height so hiding the quote does not leave an
  empty stretch of card below the last bar. Measured live in a 932px content
  column: 198.9px against 219.66px before (a 20.76px mismatch), 223.57px against
  223.57px after. The column's width and the absence of overflow are unchanged, and
  the cards still cover only part of the banner — 40% of its area after, 38%
  before. With the quote hidden, or its source empty, the row falls back to two
  198.9px cards with no empty element left behind.
- The two cards are pushed to the banner's opposite edges instead of sitting side by
  side: the calendar against the left inset, the progress-and-quote card against the
  right, with the wallpaper between them. The inset is the banner's own 14px padding,
  so neither card touches the border, and neither card grows — all the spare room in
  the row becomes the gap. Measured live in a 932px content column: the calendar
  occupies 46–266px either way, and the progress card 700–950px where it used to
  occupy 278–528px, so the space between them goes from 12px to 434px. The cards stay
  equal height (223.57px each), and the column's width (932px) and the absence of
  overflow (`scrollWidth === clientWidth`) are unchanged. A lone card — calendar
  hidden, or every progress widget off — sits at the left end.
- The two cards are also the same width, and it is the narrower one's: the
  progress-and-quote card takes the month grid's width rather than the calendar
  being widened to meet it, so less wallpaper is covered. Both are 220px where the
  progress card used to be 250px, measured live in a 932px content column, and the
  cards now cover 37.7% of the banner's area. Inside the narrower card nothing
  wraps or overflows: the label no longer stretches, so a progress row's label and
  its "set a birth date" hint stay on one line, and the fixed-width tabular
  percentage keeps its position as digits turn over. The equal height (223.57px),
  the edge split, the quote's three-line clamp, the column's width and the absence
  of overflow are unchanged.
- The type is plainer and no longer glows. The per-glyph halo — four stacked
  `text-shadow` rings in the theme's background colour — is replaced by one soft
  shadow under the glyph, and the legibility it used to carry moves into the card:
  the scrim goes from 7% to 32% and the frost from `blur(2px)` to `blur(4px)`. The
  quote is set upright at 12px/1.45 at full strength, where it was italic at
  11.5px/1.4 and 94% opacity; the muted weekday and hint labels go from 72% to 78%.
  The trade is deliberate: the wallpaper is a little less crisp through a card than
  it was at 7%, which is what buys comfortable text without putting an opaque panel
  back.
- The cards no longer follow the host's light/dark theme. The scrim, the ink and
  the shadow colour were mixed from `--ls-primary-background-color` and
  `--ls-primary-text-color`; that variable is *white* in the light theme, so the
  scrim lightened a dark photograph almost not at all while the theme's dark ink sat
  on top of that dark image — unreadable. They are constants now
  (`rgba(12, 15, 22, 0.3)` over the wallpaper, `#f0f3f8` ink, `#0c0f16` shadow), a
  dark glass carrying light type that works over any wallpaper in either theme, and
  the shadow under the glyph softens to `0 1px 1px` at 24% now that it no longer
  has to fight a mismatched scrim. The accent is still the theme's
  (`--lx-accent-11`).

### Fixed

- Clicking a date whose journal page exists but is empty now navigates. Every such
  click did nothing at all, permanently and for every empty day, which looked like
  the banner going dead after a few working clicks: `createJournalPage` answers
  `null` for a journal page that already exists and holds no blocks — while a page
  it has just created and a page with content both come back as full entities — so
  `openJournalDay` never reached `pushState`. The day is now resolved from the
  graph whenever the create call declines to name it. Verified live over 22
  consecutive clicks across days with content, days whose page is empty and days
  with no page at all: 12 failures out of 22 before, 0 out of 22 after.

- Clicking a date in the calendar no longer does nothing every so often. The
  renderer rebuilt the whole widget container whenever the *set* of rendered
  widgets changed, and the quote widget dropped out of that set for the ticks
  between a cache invalidation and its reload — twice per navigation. A rebuild
  between mousedown and mouseup detaches the pressed button, and Chrome then fires
  no `click` at all, so the delegated handler never ran. Widgets and cards are now
  reconciled by key, so one appearing or disappearing leaves every other element
  in place; measured live, a click no longer produces any DOM churn at all (13
  child-list mutations before, 0 after).
- The marker dot for a day you just wrote in appears in about 0.8s instead of up
  to 60s (measured: 59.6s before, 0.5–1.0s after).

- Clicks on banner widgets keep working after a plugin reload. A banner left behind
  by the previous instance carried only that instance's listener, which died with
  its iframe; the banner is now rebuilt on startup and the listener re-attached
  when an orphan is adopted. Host-document nodes are also no longer tested with
  `instanceof`, which is always false across the iframe/host realm boundary.
- The banner no longer collapses the journal content column. It used to be
  injected into `#main-content-container`, a `flex-direction: row` container whose
  only flex child is the content column, so the banner became a second flex item
  beside that column (`flex: 1 1 0%`) and squeezed it to zero width — the page's text rendered one
  character per line at the right edge of the viewport. The banner now mounts
  inside `.cp__sidebar-main-content`, where it takes part in normal block flow.

## [0.1.0] - 2026-07-25

### Added

- Banner region injected at the top of the Logseq DB main content area, re-attached
  automatically after navigation.
- Local wallpaper background from an absolute path, an `https://` URL or a
  graph-relative asset path, with fit/position settings and a gradient fallback
  when the image cannot be loaded.
- Time-progress widgets for the current day, week and year, plus a life-progress
  bar computed from a birth date and a configurable lifespan (default 85 years).
  They refresh every second without a manual reload.
- Plugin settings for the wallpaper source, fit, position, banner height, birth
  date, lifespan, week start and per-widget visibility.
