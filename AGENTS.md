# Project agent memory

Logseq plugin that renders a banner (local wallpaper + time-progress widgets) at the top of a journal view's content column.
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
- Pure, tested logic: `src/progress.ts` (date/span math), `src/format.ts` (percent and date strings), `src/settings.ts` (raw-setting normalisation and `assets://` URL building), `src/widgets.ts` (the widget registry), `src/journal.ts` (the journal-only mount decision). Each has a sibling `*.test.ts`.
- Runtime wiring: `src/main.ts` (settings schema, tick loop, Logseq hooks) is untested; `src/banner.ts` (host-document DOM) is covered by a jsdom test of the mount point and the CSS-scoping contract. Put new logic in a pure helper instead of growing either.
- `src/widgets.ts` `widgetDefinitions` is the single widget list; its visibility settings are generated in `main.ts` as `show<Id>Progress`. Adding a widget should not touch `banner.ts`.

## Platform facts worth not rediscovering

All were verified against a live Logseq 2.0.1 DB graph, not just read from docs:

- **Banner injection**: the host document (reached via `window.parent.document` from the plugin iframe) has `#main-content-container` as a `display: flex; flex-direction: row` container holding the content column `.cp__sidebar-main-content` (`flex: 1 1 0%`) and the right sidebar. Injecting anything into the flex row starves the content column to zero width, so the banner mounts *inside* the column — see `HOST_ANCHOR_SELECTOR` in `src/banner.ts`. Logseq keeps those containers across route changes, but the banner is re-attached on every tick anyway so an app-side re-mount cannot leave it orphaned. CSS goes in through `logseq.provideStyle`, which is global to the host document, so every rule must stay scoped to `#lsdb-banner`.
- **Where the app is**: the route name is available as `logseq.App.getStateFromStore(['route-match', 'data', 'name'])` (`home`, `page`, `allPages`, `allJournals`, `graph`, `plugins`, `settings`, …). Asking for the whole `route-match` map instead never resolves — the reitit match is not serialisable across the plugin bridge and the call dies with `[deferred timeout]`.
- **Journal detection**: a DB-graph page entity from `logseq.Editor.getCurrentPage()` has neither `journal?` nor `type`, contrary to `@logseq/libs` typings; only a journal page carries `journalDay` (`20260725`). Verify API shapes at runtime before relying on them.
- **Local files**: `assets://` is a privileged scheme (`standard`, `secure`, `bypassCSP`, `supportFetchAPI`, `streaming`); its Electron handler strips the prefix, `decodeURIComponent`s the rest and serves it as an absolute filesystem path. `assets:///abs/path` — per-segment percent-encoded, which is also what Logseq's own `make_asset_url` emits — is therefore the way to show a user's own image. `file://` is *not* privileged and the renderer runs on `lsp://logseq.com`, so `file://` subresources are blocked.
- DB graphs still have an on-disk assets folder (`~/logseq/graphs/<Name>/assets`), which is what `logseq.Assets.makeUrl('../assets/x.png')` resolves against.
- A Windows drive letter (`C:\...`) matches the URI-scheme regex, so any path/URL discrimination must test the path shape first — see `resolveWallpaperSource`.

The markdown-era prior art (`yoyurec/logseq-banners-plugin`) is a useful reference for the banner concept, but its per-page configuration (`banner::` page properties, the `pre-block` props MutationObserver, `body[data-page]` page-type detection, `:block/content` datascript queries) depends on the file-graph model and does not carry over.

## Verifying against a live Logseq

Never attach to the user's running Logseq. Launch a throwaway one instead, fully isolated:

```bash
env HOME=<scratch>/home /Applications/Logseq.app/Contents/MacOS/Logseq \
  --user-data-dir=<scratch>/lsq-userdata --remote-debugging-port=9333 &
```

`HOME` is what isolates it: Electron resolves the plugins directory from `app.getPath('home')` and the graphs directory from `LOGSEQ_GRAPHS_DIR` (default `~/logseq/graphs`), so a fresh `HOME` yields a fresh DB graph and no inherited plugins. A private `--user-data-dir` alone does *not* — the first launch still opens the user's graph, which means two Electron processes on one SQLite file.

Then drive it over CDP (`CHROME_DEVTOOLS_AXI_BROWSER_URL=http://127.0.0.1:9333 chrome-devtools-axi …`) and load the build with `LSPluginCore.unregister('db-banner')` followed by `LSPluginCore.register({ url: '<repo path>' })`; that pair is also how you reload after `npm run build`. From the host page, `logseq.api.<snake_case>` calls run directly; to test what the *plugin* sees, reach into its iframe (`contentWindow.logseq`) — the plugin bridge has different serialisation limits than the host.

## Conventions

Commit subjects follow Conventional Commits (`feat:`, `chore:`). Feature commits carry their own `CHANGELOG.md` entries under `## [Unreleased]`. The README documents settings in both Chinese and English, so a behaviour change usually touches both language sections.

## Maintaining this file

Keep this file for knowledge useful to almost every future agent session in this project.
Do not repeat what the codebase already shows; point to the authoritative file or command instead.
Prefer rewriting or pruning existing entries over appending new ones.
When updating this file, preserve this bar for all agents and keep entries concise.
