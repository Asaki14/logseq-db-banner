# Project agent memory

Logseq plugin that renders a banner (local wallpaper + time-progress widgets) at the top of the main content area.
It targets **DB graphs only** — `package.json` declares `logseq.unsupportedGraphType: "file"`, so file-graph code paths are out of scope, not merely untested.

## Commands

Use the `package.json` scripts, not raw `tsc`/`vite`/`vitest`:

- `npm ci` — install (Node.js 20+, per `.github/workflows/ci.yml`).
- `npm run build` — typecheck (`tsc --noEmit`) then Vite build into `dist/`.
- `npm run dev` — watch build; reload the plugin in Logseq to pick up output.
- `npm run test` — Vitest, single run.
- `npm run check` — test + build; exactly what CI runs, so run it before proposing a change.

## Layout and sources of truth

- Plugin manifest: the `logseq` field in `package.json`. There is no separate manifest file.
- Entry point: `main` points at `dist/index.html`, which Vite generates from the root `index.html`. `dist/` is gitignored build output — never hand-edit or commit it.
- Pure, tested logic: `src/progress.ts` (date/span math), `src/format.ts` (percent and date strings), `src/settings.ts` (raw-setting normalisation and `assets://` URL building), `src/widgets.ts` (the widget registry). Each has a sibling `*.test.ts`.
- Untested runtime wiring: `src/banner.ts` (host-document DOM) and `src/main.ts` (settings schema, tick loop, Logseq hooks). Put new logic in a pure helper instead of growing these.
- `src/widgets.ts` `widgetDefinitions` is the single widget list; its visibility settings are generated in `main.ts` as `show<Id>Progress`. Adding a widget should not touch `banner.ts`.

## Platform facts worth not rediscovering

Both were verified against a live Logseq 2.0.1 DB graph, not just read from docs:

- **Banner injection**: Logseq's main content area is `#main-content-container` in the *host* document, reached via `window.parent.document` from the plugin iframe. Logseq keeps that container across route changes, but the banner is re-attached on every tick anyway so an app-side re-mount cannot leave it orphaned. CSS goes in through `logseq.provideStyle`.
- **Local files**: `assets://` is a privileged scheme (`standard`, `secure`, `bypassCSP`, `supportFetchAPI`, `streaming`); its Electron handler strips the prefix, `decodeURIComponent`s the rest and serves it as an absolute filesystem path. `assets:///abs/path` — per-segment percent-encoded, which is also what Logseq's own `make_asset_url` emits — is therefore the way to show a user's own image. `file://` is *not* privileged and the renderer runs on `lsp://logseq.com`, so `file://` subresources are blocked.
- DB graphs still have an on-disk assets folder (`~/logseq/graphs/<Name>/assets`), which is what `logseq.Assets.makeUrl('../assets/x.png')` resolves against.
- A Windows drive letter (`C:\...`) matches the URI-scheme regex, so any path/URL discrimination must test the path shape first — see `resolveWallpaperSource`.

The markdown-era prior art (`yoyurec/logseq-banners-plugin`) is a useful reference for the banner concept, but its per-page configuration (`banner::` page properties, the `pre-block` props MutationObserver, `body[data-page]` page-type detection, `:block/content` datascript queries) depends on the file-graph model and does not carry over.

## Conventions

Commit subjects follow Conventional Commits (`feat:`, `chore:`). Feature commits carry their own `CHANGELOG.md` entries under `## [Unreleased]`. The README documents settings in both Chinese and English, so a behaviour change usually touches both language sections.

## Maintaining this file

Keep this file for knowledge useful to almost every future agent session in this project.
Do not repeat what the codebase already shows; point to the authoritative file or command instead.
Prefer rewriting or pruning existing entries over appending new ones.
When updating this file, preserve this bar for all agents and keep entries concise.
