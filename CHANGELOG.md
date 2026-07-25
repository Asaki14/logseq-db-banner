# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
