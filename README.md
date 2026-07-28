# DB Banner

[中文](README.zh-CN.md)

A banner plugin for **Logseq DB graphs**. It renders a strip at the top of a journal
view's content column: your own wallpaper as the background, with two frosted-glass cards
on top — the month calendar on the left, the four time-progress bars and the quote of the
day on the right.

![The banner at the top of a journal page: wallpaper, the month calendar with marker dots, four progress bars and a quote](docs/screenshots/banner.png)

## Features

- **Journal views only.** The banner appears on the journals feed (the scrolling
  multi-day view) and on a single journal page. Normal pages, all-pages, settings,
  graph view, whiteboards and plugin pages get none; leaving a journal removes the
  banner and returning re-renders it.
- **Local wallpaper** from an absolute path on your machine, an `https://` URL, or a
  path relative to the graph's `assets` folder. Fit and position are configurable, and
  a missing or unreadable image falls back to a gradient while the widgets stay readable.
- **Two cards, one surface, equal height, held apart.** The calendar sits against the
  banner's left inset, the progress bars against its right — the inset is the banner's own
  14px padding, so neither card is flush against the border. Each card is only as wide as
  its own content, so pushing them apart widens the space between them rather than the
  cards: measured on a 932px content column, the calendar occupies 46–266px and the
  progress card 700–950px, with 434px of bare wallpaper between them. A lone card (calendar
  hidden, or every progress widget off) sits at the left end. Their heights
  are **equal, not merely similar**: the row takes the height of the taller card's content
  and the other stretches to it (measured live: a 0px difference), and the progress card
  spreads its content over that height, so hiding the quote does not leave a pool of empty
  card under the last bar. They share one type
  scale, one spacing rhythm, one corner radius and one accent — the same colour marks
  "today" in the calendar and fills the progress bars. The scrim is light
  (`rgba(12, 15, 22, 0.3)`) over a `blur(4px)` frost, so the wallpaper still reads through
  a card; what also defines a card is its **edge** — an ink hairline with a 1px inset dark
  line and a soft outer glow, which stays visible over a
  wallpaper of any brightness. The type carries **no glyph halo** any more: the stacked
  omnidirectional `text-shadow` that used to ring every letter made the text glow and made
  reading it work. Legibility is now the scrim's job, helped by a single soft shadow
  underneath the glyph (`0 1px 1px` at 24%).
  **The cards deliberately do not follow the host theme.** The banner is a surface laid
  over an image, not part of the page: `--ls-primary-background-color` is white in the
  light theme, so a scrim mixed from it barely darkened a dark photograph while the
  theme's dark ink sat on top of that dark image — unreadable. The scrim and the ink are
  therefore constants, dark glass carrying light type, which works over any wallpaper in
  either theme. Only the accent still comes from the theme (`--lx-accent-11`).
- **Time-progress widgets** for the current day, week, year and life, each with a label,
  a bar and a percentage to **three decimals** (`41.286%`). There is no remaining-time
  line. The percentage uses tabular figures in a fixed-width field, so the last digit
  turning over — about once every 0.86 s on the day bar — cannot shift the row sideways.
  They refresh every second — no manual reload.
- **Life progress** is computed from a birth date and a lifespan (85 years by default).
  A birth date in the future reads 0%; an exceeded lifespan reads 100%.
- **A month calendar** with today highlighted and a marker dot on every day whose journal
  page already has content. Clicking a date opens that day's journal — for any day, whether
  its page has content, exists but is empty, or does not exist at all. The first column
  follows the `Week starts on` setting.
  After you write a block, its dot appears within about a second — the plugin listens to
  `logseq.DB.onChanged` rather than waiting out a cache TTL.
- **A quote** at the foot of the progress card — it is a reading like the
  bars are, so it belongs on the same card rather than as a third loose block. It is set
  upright at 12px rather than as dimmed italics, so it reads as a sentence rather than a
  caption. The source
  is a configurable tag (`quotes` by default), read in both of the shapes a tag is worn:
  every *block* carrying it, at any depth, plus the top-level blocks of every *page*
  carrying it. That makes Logseq's built-in `Quote` node type usable as-is — set
  `Quote source tag` to `Quote` and no data has to be migrated. (Built-in `Quote` is the
  class `:logseq.class/Quote-block`, the tag a file-graph import puts on blocks that were
  written as `#quote`. It sits on the blocks, never on a page, so a page-tag-only query
  finds nothing.) **A new quote on every arrival**: one is picked when you land on a
  journal view — the first mount, and every return from another page — and then held for
  the whole visit, so neither the per-second re-render nor the quote cache going stale can
  make it jump. With more than one candidate it never repeats the one just shown, and
  navigating from one journal day to another counts as two arrivals, so it changes there
  too. A single candidate is simply shown again. A missing
  tag, a tag with no blocks under it or a failed query degrades quietly: no widget, no
  error, and the rest of the banner keeps working. A long quote is truncated and clamped
  to three lines, so it cannot resize the banner.
- The banner re-attaches itself after page navigation.

Both of those widgets need graph queries, while the banner re-renders every second: their
data is cached per key (the visible month, the tag name) and re-read only on a graph write
(`logseq.DB.onChanged`, coalesced over 300ms and forced after 1.5s of an unbroken burst),
a route change, a settings change, or once the entry ages past its TTL (60s for the
calendar, 5min for the quote) — never on a tick. An invalidated entry keeps being shown
until its replacement lands, so nothing blinks out of the banner while it refreshes.

The banner is `280px` tall by default, which fits an unhurried month grid and still
leaves a broad expanse of wallpaper: the two cards cover about 40% of the banner's area —
38% before they were made equal height, against 88% for the old full-width layout. That height is a *minimum*: set it shorter and
the banner grows to whatever its content needs instead of clipping or overlapping.

## DB graphs only

At startup the plugin calls `logseq.App.checkCurrentIsDbGraph()` and exits with a warning
if the current graph is a file graph. That runtime check is the only gate: `package.json`
declares `logseq.unsupportedGraphType: "file"`, but Logseq 2.0.1 does not read that field,
so it will happily enable the plugin on a file graph. Because the answer arrives as `false`
for the milliseconds before a graph finishes loading, the check is repeated until a graph
is actually loaded — a slow start no longer leaves the banner switched off for the session.

## Settings

Configure these under `Settings → Plugin Settings → DB Banner`, or through the plugin's
toolbar icon — pin it from the toolbar's plugins popover and it opens the same pane:

| Setting | Default | Notes |
| --- | --- | --- |
| Wallpaper source | empty | An absolute local path (`/Users/me/Pictures/wall.jpg`, or `D:\Pictures\wall.jpg` on Windows), an `https://` URL, a `data:` URI, or a graph-relative path (`../assets/wall.jpg`). Empty, `false`, `none` and `off` all mean "no wallpaper". |
| Wallpaper fit | `cover` | `cover`, `contain` or `tile`. |
| Wallpaper position | `50% 50%` | CSS `background-position`, for example `center top`. |
| Banner height | `280px` | A CSS length such as `280px` or `32vh`. It is a minimum — a value too small for the cards makes the banner grow rather than clip. |
| Birth date | empty | `YYYY-MM-DD`. Without it the life widget shows `--%`. |
| Lifespan in years | `85` | Denominator of the life-progress bar. |
| Week starts on | `monday` | `monday`, `sunday` or `saturday`; sets the week-progress boundary and the calendar's first column. |
| Quote source tag | `quotes` | Name of the tag the quotes belong to, on the blocks or on their page. `quotes`, `#quotes` and `[[Quotes]]` all work, case-insensitively; `Quote` selects Logseq's built-in `Quote` node type. One is picked on every arrival at a journal view. Empty turns the quote widget off. |
| Show day / week / year / life / calendar / quote widget | all on | Per-widget visibility. |

Phase 2 renamed the visibility keys from `show<Id>Progress` to `show<Id>Widget`, since
"progress" no longer fits a calendar or a quote. On first start the plugin copies the old
values onto the new keys and writes `settingsVersion: 2` as a one-shot stamp; afterwards
the old keys are ignored. So an existing configuration is not reset, and a later change to
a new key is not reverted to the phase 1 value. The old keys stay in the settings file, so
rolling back to an older build keeps your choices.

Invalid values fall back to the defaults rather than reaching the stylesheet. A path
starting with `~` cannot be expanded from the plugin sandbox and is treated as unset —
use the full absolute path.

## How the wallpaper reaches a local file

Logseq's desktop shell registers `assets://` as a privileged scheme (`standard`,
`secure`, `bypassCSP`, `supportFetchAPI`, `streaming`). Its Electron handler strips the
`assets://` prefix, runs `decodeURIComponent`, and serves the remainder as an absolute
filesystem path. So:

- an absolute POSIX path becomes `assets:///absolute/path`, percent-encoded per segment so
  spaces and `#` are safe — the same shape Logseq's own `make_asset_url` produces;
- a Windows path becomes `assets:///D/logseq__colon/rest/of/path`. Because `assets:` is a
  *standard* scheme, Chromium folds the leading slashes into the URL's host, so the drive
  letter lands there — and a host cannot hold a colon in any form: `%3A` makes the whole
  URL invalid, a literal `:` is read as a port and the drive is lost. `logseq__colon` is
  Logseq's own stand-in for it, which the handler turns back into `D:/` before reading the
  file;
- a graph-relative path is handed to `logseq.Assets.makeUrl()`, which resolves it inside
  the current DB graph's `assets` folder.

`file://` is not privileged and the renderer runs on the `lsp://logseq.com` origin, so
`file://` subresources are blocked — `assets://` is the mechanism that works.

## How a journal view is recognised, and where the banner mounts

The decision comes from host state, not from the URL string:

- the route name, `logseq.App.getStateFromStore(['route-match', 'data', 'name'])` —
  `home` and `allJournals` are journal feeds, `page` is `/page/:name`. It has to be read
  through the path form: the whole `route-match` map is not serialisable across the
  plugin bridge, and asking for it only times out;
- the current page, `logseq.Editor.getCurrentPage()` — on a Logseq 2.0.1 DB graph a page
  entity carries neither `journal?` nor `type`, whatever the typings say. Only a journal
  page has `journalDay` (`20260725`).

`shouldMountBanner` in `src/journal.ts` is the pure function that decides, so it is unit
tested without a live host.

The mount point is `#main-content-container .cp__sidebar-main-content`, not
`#main-content-container` itself: that container is a `display: flex; flex-direction: row`
scroll container whose only flex child is the content column (`flex: 1 1 0%`), so a banner
injected there becomes a flex item beside the column and squeezes it to zero width. (The
right sidebar, `#right-sidebar`, is a sibling of the scroll container under
`#app-container`, and narrows the column from the outside.) Every injected CSS rule is
scoped to `#lsdb-banner`; no host container is restyled.

## Install from source

Node.js `^20.19.0 || ^22.13.0 || >=24.0.0` is required — 20.19.0+ on the 20.x line,
22.13.0+ on 22.x, or anything from 24. That range is `engines.node` in `package.json`
and comes from the `jsdom` dev dependency; an older runtime fails `npm ci` with a plain
version error.

```bash
npm ci
npm run check   # tests + typecheck + build into dist/
```

1. Enable Developer Mode in Logseq.
2. Open `Plugins` and select `Load unpacked plugin`.
3. Select this repository's root folder (it holds `package.json` and the built `dist/`).

After changing sources run `npm run build` and reload the plugin in Logseq. Use
`npm run dev` for a watch build.

## Adding a widget

`widgetDefinitions` in `src/widgets.ts` is the single widget list. Append one descriptor
and `banner.ts` stays untouched:

- `build(context, data)` is pure and returns a `WidgetNode` tree (see `src/view.ts`) —
  plain data, so it is unit tested without a DOM. `null` means "nothing to show" and the
  widget is skipped.
- A widget that needs the graph also implements `request(context)`, returning
  `{ key, ttlMs, load(host) }`. The runtime caches per `key` and `ttlMs`, renders from the
  cache synchronously, and loads in the background.
- For click behaviour, put an `action` on a node (`{ kind: 'openJournalDay', day }`). The
  renderer dispatches actions by delegation, so widgets never attach listeners.
- `group` picks the card the widget lands on: `'calendar'` or `'panel'` (the default).
  The renderer reconciles cards by group id and widgets by widget id, so a widget
  appearing or disappearing never rebuilds its neighbours' DOM.
- The visibility setting is generated as `show<Id>Widget`.

## License

[MIT](LICENSE)
