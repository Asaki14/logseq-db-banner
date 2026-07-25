# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Banner region injected at the top of the Logseq DB content column, re-attached
  automatically after navigation.
- Local wallpaper background from an absolute path, an `https://` URL or a
  graph-relative asset path, with fit/position settings and a gradient fallback
  when the image cannot be loaded.
- Time-progress widgets for the current day, week and year, plus a life-progress
  bar computed from a birth date and a configurable lifespan (default 85 years).
  They refresh every second without a manual reload.
- Plugin settings for the wallpaper source, fit, position, banner height, birth
  date, lifespan, week start and per-widget visibility.
- Calendar widget: the current month, today highlighted, a marker dot on every day
  whose journal page already holds content, and a click that opens that day's
  journal — creating the page first when it does not exist yet, because navigating
  to a missing journal page renders a blank content column. The first column
  follows the `Week starts on` setting. The has-content query is cached per month
  and dropped on a route change, a settings change or after 60 seconds, so the
  per-second re-render never touches the graph.
- Quote widget: one quote per calendar day, picked by a date-seeded hash over the
  top-level blocks of every page carrying the configurable source tag (`quotes` by
  default). Stable for the whole day and across a re-mount, different the next day.
  A missing tag, an empty source or a failed query renders nothing at all, and a
  long quote is truncated and clamped so it cannot resize the banner.
- `Quote source tag` setting.

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
  at their foot, equal height and aligned. They share one type scale, one spacing
  rhythm, one corner radius and one accent — the colour that marks "today" is the
  colour that fills the bars. Card and text colours are blended from Logseq's own
  theme variables (`--ls-primary-background-color`, `--ls-primary-text-color`,
  `--lx-accent-11`) with `color-mix`, so both themes are followed without a
  hard-coded palette.
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
- The frosted cards are far more transparent, so the wallpaper reads through them.
  The card scrim went from 58% of the theme background to 20%, over a heavier
  `blur(20px)`. Legibility is carried by a glyph halo instead of by an opaque
  panel: a stacked `text-shadow` in the theme's background colour, which is a scrim
  the size of each glyph and leaves the space between glyphs transparent. Because
  the theme always pairs light ink with a dark background and vice versa, the halo
  is always the opposite of the text, so light ink stays readable over a bright
  wallpaper and dark ink over a night photograph. Checked in both themes against
  both a dark landscape and a bright high-frequency wallpaper.
- The progress readout shows three decimals (`41.286%`, was `41.8%`), in tabular
  figures in a fixed-width field so the last digit — which turns over about once a
  second on the day bar — cannot shift the row sideways.
- The progress widgets no longer show a remaining-time line. The bar, the label and
  the percentage stay; "12h left", "3d left" and "49.4y left" are gone, and the
  slot is reused only for the life bar's "set a birth date" hint.

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
