# DB Banner Agent Guide

Logseq plugin that adds a calendar, time-progress widgets, a quote, and wallpaper to journal views in DB graphs. File graphs are unsupported.

## Repository map

- `src/main.ts`: plugin startup, settings registration, and host event wiring.
- `src/fields.ts`, `src/settings.ts`: user-facing settings and defaults.
- `src/widgets.ts`, `src/banner.ts`, `src/panel.ts`: widget definitions, banner rendering, and settings UI.
- `src/host.ts`, `src/query.ts`, `src/cache.ts`: graph reads and cached widget data.
- `src/progress.ts`, `src/calendar.ts`, `src/quote.ts`, `src/journal.ts`: widget calculations and journal-view behavior.
- `src/*.test.ts`: unit and DOM tests.
- `README.md`, `README_CN.md`: English and Chinese user guides.
- `llms.txt`: agent-facing project summary and installation guidance.
- `docs/screenshots/banner.png`: README screenshot.
- `.github/workflows/ci.yml`: continuous integration; `.github/workflows/publish.yml`: release packaging.

## Commands

- `npm ci` — install dependencies.
- `npm run check` — run tests, typecheck, and build; this is the CI check.
- `npm run dev` — watch build.

Settings are defined once in `src/fields.ts`; keep both README files in sync when user-facing behavior changes. Record user-visible changes under `Unreleased` in `CHANGELOG.md`.
