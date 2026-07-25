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
- Pure, tested logic: `src/progress.ts` (date/span math and `journalDay` conversion), `src/format.ts` (percent, month and date strings), `src/settings.ts` (raw-setting normalisation, `assets://` URL building, settings-key migration), `src/widgets.ts` (the widget registry), `src/calendar.ts` (month grid), `src/quote.ts` (date-seeded pick), `src/query.ts` (datascript query text), `src/cache.ts` (the TTL/single-flight data cache), `src/view.ts` (the node-tree/action contract), `src/journal.ts` (the journal-only mount decision). Each has a sibling `*.test.ts`.
- Runtime wiring: `src/main.ts` (settings schema, tick loop, Logseq hooks) and `src/host.ts` (the live graph reads and journal navigation) are untested; `src/banner.ts` (host-document DOM) is covered by a jsdom test of the mount point, the node renderer, click delegation and the CSS-scoping contract. Put new logic in a pure helper instead of growing any of them.
- `src/widgets.ts` `widgetDefinitions` is the single widget list: a descriptor pairs a pure `build` returning a `WidgetNode` tree with an optional cached `request` for host data, so adding a widget touches neither `banner.ts` nor `main.ts` beyond the generated `show<Id>Widget` visibility setting. `show<Id>Progress` is the phase 1 name, still migrated once (see `settingsMigration`).

## Platform facts worth not rediscovering

All were verified against a live Logseq 2.0.1 DB graph, not just read from docs:

- **Banner injection**: the host document (reached via `window.parent.document` from the plugin iframe) has `#main-content-container` as a `display: flex; flex-direction: row` scroll container whose only flex child is the content column `.cp__sidebar-main-content` (`flex: 1 1 0%`). The right sidebar (`#right-sidebar`) is *not* in there — it sits under `#app-container` beside the scroll container. Injecting anything into the flex row makes it a second flex item and starves the content column to zero width, so the banner mounts *inside* the column — see `HOST_ANCHOR_SELECTOR` in `src/banner.ts`. Logseq keeps those containers across route changes, but the banner is re-attached on every tick anyway so an app-side re-mount cannot leave it orphaned. CSS goes in through `logseq.provideStyle`, which is global to the host document, so every rule must stay scoped to `#lsdb-banner`.
- **Where the app is**: the route name is available as `logseq.App.getStateFromStore(['route-match', 'data', 'name'])` (`home`, `page`, `allPages`, `allJournals`, `graph`, `plugins`, `settings`, …). Asking for the whole `route-match` map instead never resolves — the reitit match is not serialisable across the plugin bridge and the call dies with `[deferred timeout]`.
- **Journal detection**: a DB-graph page entity from `logseq.Editor.getCurrentPage()` has neither `journal?` nor `type`, contrary to `@logseq/libs` typings; only a journal page carries `journalDay` (`20260725`). Verify API shapes at runtime before relying on them.
- **Local files**: `assets://` is a privileged scheme (`standard`, `secure`, `bypassCSP`, `supportFetchAPI`, `streaming`); its Electron handler strips the prefix, `decodeURIComponent`s the rest and serves it as an absolute filesystem path. `assets:///abs/path` — per-segment percent-encoded, which is also what Logseq's own `make_asset_url` emits — is therefore the way to show a user's own image. `file://` is *not* privileged and the renderer runs on `lsp://logseq.com`, so `file://` subresources are blocked.
- DB graphs still have an on-disk assets folder (`~/logseq/graphs/<Name>/assets`), which is what `logseq.Assets.makeUrl('../assets/x.png')` resolves against.
- A Windows drive letter (`C:\...`) matches the URI-scheme regex, so any path/URL discrimination must test the path shape first — see `resolveWallpaperSource`.
- **`datascriptQuery` inputs never arrive from a plugin.** `logseq.DB.datascriptQuery(query, ...inputs)` is typed variadic, but across the plugin bridge a query declaring `:in $ ?from` fails with `Too few inputs passed, expected: [$ ?from], got: 1` — one extra arg, an array, a string, a number, all the same. (From the *host* page, `logseq.api.datascript_query` does bind numeric inputs, and strings bind in a function clause but match nothing in a data pattern, so host-side probing is misleading here.) Every value must therefore be interpolated into the query text, escaped — see `src/query.ts`.
- **Journal existence vs. content**: `[?page :block/journal-day ?day]` finds journal pages (DB graphs do keep that attribute), and adding `[?block :block/page ?page]` narrows it to days that actually hold blocks — a journal page that exists but was never written to has none. A page's property values are stored as blocks on the page too, with `:block/parent` pointing at the page just like a real top-level block, so they need excluding via `:logseq.property/created-from-property`.
- **Tags**: a page carries a tag as `:block/tags` → the tag entity, whose `:block/name` is the lowercased title, so matching on `:block/name` works for both a UI-made tag and a plugin-made one (`create_tag` from a plugin creates a namespaced `:plugin.class.<id>/<name>` ident, and `create_page(name, { tags })` writes a namespaced *property*, not `:block/tags` — use `add_block_tag` to tag a page).
- **Navigating to a journal day that has no page**: `logseq.App.pushState('page', { name })` "succeeds" — the route becomes `page` — but the content column renders blank and `getCurrentPage()` stays `null`. So create the page first: `logseq.Editor.createJournalPage` is idempotent (an existing day comes back with its blocks untouched) and returns the entity whose `name` `pushState` accepts. Its `string | Date` typing is wrong in both arms: a string is silently ignored (returns `null`, creates nothing) and a number is read as epoch milliseconds — `createJournalPage(20260804)` created *1 January 1970*. Pass `date.getTime()`.
- **Cross-realm `instanceof` is always false** on anything from the host document: those nodes belong to `window.parent`'s realm, so `target instanceof Element` inside the plugin iframe rejects every host node. Duck-type instead (`typeof target?.closest === 'function'`).
- **A plugin's own `logseq.updateSettings` is invisible to it**: when the promise resolves `logseq.settings` still holds the old values, and no `onSettingsChanged` fires. Apply the patch to in-memory state directly — `readConfig(patch)` in `main.ts`.
- `logseq.useSettingsSchema` writes every schema default into the settings file before the plugin's own code runs, so "is this key unset?" cannot tell a default apart from a user's choice. A rename migration therefore needs its own stamp (`settingsVersion`), not the absence of the new key.

The markdown-era prior art (`yoyurec/logseq-banners-plugin`) is a useful reference for the banner concept, but its per-page configuration (`banner::` page properties, the `pre-block` props MutationObserver, `body[data-page]` page-type detection, `:block/content` datascript queries) depends on the file-graph model and does not carry over.

## Verifying against a live Logseq

Never attach to the user's running Logseq. Launch a throwaway one instead, fully isolated:

```bash
env HOME=<scratch>/home CFFIXED_USER_HOME=<scratch>/home \
  /Applications/Logseq.app/Contents/MacOS/Logseq \
  --user-data-dir=<scratch>/lsq-userdata --remote-debugging-port=9333 &
```

**Both** variables are needed, and a private `--user-data-dir` alone isolates nothing (the first launch still opens the user's graph — two Electron processes on one SQLite file). `HOME` moves the graphs directory (`LOGSEQ_GRAPHS_DIR`, default `$HOME/logseq/graphs`), so a fresh one yields a fresh DB graph. It does *not* move `~/.logseq`, which holds the plugins directory and every plugin's settings file: that path comes from Electron's `app.getPath('home')`, i.e. macOS `NSHomeDirectory()`, which ignores `$HOME` and honours `CFFIXED_USER_HOME`. With `HOME` alone the throwaway instance loads the user's plugins — including an installed copy of *this* plugin — and rewrites `~/.logseq/preferences.json` and `~/.logseq/settings/*.json` within seconds of starting, while the user's own Logseq may be running. Verify isolation before touching anything: `LSPluginCore.registeredPlugins` must be empty and `<scratch>/home/.logseq/` must exist.

Then drive it over CDP (`CHROME_DEVTOOLS_AXI_BROWSER_URL=http://127.0.0.1:9333 chrome-devtools-axi …`) and load the build with `LSPluginCore.unregister('db-banner')` followed by `LSPluginCore.register({ url: '<repo path>' })`; that pair is also how you reload after `npm run build`. From the host page, `logseq.api.<snake_case>` calls run directly; to test what the *plugin* sees, reach into its iframe (`contentWindow.logseq`) — the plugin bridge has different serialisation limits than the host.

## Conventions

Commit subjects follow Conventional Commits (`feat:`, `chore:`). Feature commits carry their own `CHANGELOG.md` entries under `## [Unreleased]`. The README documents settings in both Chinese and English, so a behaviour change usually touches both language sections.

## Maintaining this file

Keep this file for knowledge useful to almost every future agent session in this project.
Do not repeat what the codebase already shows; point to the authoritative file or command instead.
Prefer rewriting or pruning existing entries over appending new ones.
When updating this file, preserve this bar for all agents and keep entries concise.
