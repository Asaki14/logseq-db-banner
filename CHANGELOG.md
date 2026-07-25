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

### Fixed

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
