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

### Changed

- The banner is journal-only: it renders on the journals feed and on a single
  journal page, and is removed on every other view — normal pages, all-pages,
  settings, graph view, whiteboards and plugin pages. The decision comes from the
  host's route name plus the current page's journal day, not from the URL.

### Fixed

- The banner no longer collapses the journal content column. It used to be
  injected into `#main-content-container`, which is a `flex-direction: row`
  container, so the banner became a flex item beside the content column
  (`flex: 1 1 0%`) and squeezed it to zero width — the page's text rendered one
  character per line at the right edge of the viewport. The banner now mounts
  inside `.cp__sidebar-main-content`, where it takes part in normal block flow.
