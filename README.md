# DB Banner

[中文](#中文) · [English](#english)

A page banner for **Logseq DB graphs**: a wallpaper from your own machine behind two
frosted-glass cards — a month calendar on the left, the day/week/year/life progress bars
and a quote of the day on the right.

## 中文

一个仅适用于 **Logseq DB graph** 的横幅插件。在日志页面内容区顶部渲染一条横幅：背景是本机壁纸，之上并排放两张半透明毛玻璃卡片——左边是当月日历，右边自上而下是当天／本周／当年／人生四条进度条，底部是每日一言。

### 功能

- **仅日志页面**：横幅只出现在日志视图——日志主页（多天滚动流）与单个日志页面。普通页面、All pages、设置、图谱视角、白板、插件页面都不会渲染横幅；离开日志视图时横幅会被移除，返回时重新渲染。
- **本机壁纸**：支持本机绝对路径、`https://` 链接，或相对于图谱 `assets` 目录的路径。可设置填充方式与位置；图片缺失或无法读取时回退为渐变背景，组件仍然可读。
- **两张卡片的版式**：日历卡在左、进度卡在右，两张卡片各自只占内容所需的大小（不再拉满整条横幅），因此卡片周围与之间都露出壁纸。卡片共用一套字号、间距、圆角与强调色（强调色同时用于"今天"和进度条填充）。遮罩很薄（主题背景色 20%）＋ `blur(20px)` 毛玻璃，壁纸能比较清晰地透过卡片；可读性由**字形光晕**保证——每个字下面画一圈主题背景色的 `text-shadow`，相当于只在字形大小上加遮罩，字与字之间仍然透明。卡片配色取自 Logseq 主题变量（`--ls-primary-background-color`、`--ls-primary-text-color`、`--lx-accent-11`），因此浅色与深色主题都自动跟随。
- **时间进度组件**：当天、本周、当年、人生四条进度条，各自显示标签、进度条与**三位小数**的百分比（如 `41.286%`）。不再显示"剩余多少小时／天／年"。百分比使用等宽数字（tabular figures）并占固定宽度，末位每约 0.86 秒变化一次也不会让整行左右抖动。每秒自动刷新，无需手动刷新页面。
- **人生进度**：由出生日期与预期寿命（默认 85 年）计算。出生日期在未来时显示 0%，寿命已超出时显示 100%。
- **当月日历**：今天高亮；已经写过内容的日期带一个小圆点；点击任意日期都会跳转到该天的日志页面——无论那天已有内容、页面存在但是空的、还是页面根本不存在。首列跟随 `Week starts on` 设置。写入一个块之后，圆点约 1 秒内出现（监听 `logseq.DB.onChanged`）。
- **每日一言**：显示在进度卡底部（与进度条同属"数字读数"，放在同一张卡里比单独占一块更连贯）。从携带指定标签（默认 `quotes`）的**所有**页面收集顶层块，按日期哈希每天固定挑选一条：同一天内重新挂载不会变，跨天会变。没有该标签的页面、没有顶层块或查询失败时，组件安静地不显示，横幅其余部分照常工作。过长的语录会被截断并限制在 3 行内，不会撑高或撑宽横幅。
- 切换页面后横幅自动重新挂载。

日历标记与语录都需要查询图谱，但横幅每秒重绘一次：这两项数据按键（当前月份 / 标签名）缓存，并在图谱写入（`logseq.DB.onChanged`，300ms 合并、最长 1.5s 强制刷新）、路由切换、设置变更或缓存超时（日历 60 秒、语录 5 分钟）时才重新查询，不会每秒打一次数据库。缓存失效时旧值继续显示到新值到达，所以刷新过程中组件不会先消失再出现。

横幅高度默认 `280px`，够放下一个不拥挤的月历，同时留出成片的壁纸。它是**最小高度**：填得太小时横幅会长到内容所需的高度，而不是裁切或重叠。默认布局下两张卡片约占横幅面积的 35%（此前为 88%）。

### 仅支持 DB graph

`package.json` 的 `logseq.unsupportedGraphType` 为 `"file"`，Logseq 不会在 file graph 上启用本插件。启动时还会再次调用 `logseq.App.checkCurrentIsDbGraph()`，若当前不是 DB graph 则提示并退出。

### 设置项

在 `Settings → Plugin Settings → DB Banner` 中配置：

| 设置 | 默认值 | 说明 |
| --- | --- | --- |
| Wallpaper source / 壁纸来源 | 空 | 本机绝对路径（如 `/Users/me/Pictures/wall.jpg`）、`https://` 链接、`data:` URI，或图谱相对路径（如 `../assets/wall.jpg`）。留空、`false`、`none`、`off` 均表示不使用壁纸。 |
| Wallpaper fit / 填充方式 | `cover` | `cover`、`contain` 或 `tile`。 |
| Wallpaper position / 图片位置 | `50% 50%` | CSS `background-position`，如 `center top`。 |
| Banner height / 横幅高度 | `280px` | CSS 长度，如 `280px`、`32vh`。这是最小高度：值太小时横幅会自行长高，不裁切。 |
| Birth date / 出生日期 | 空 | `YYYY-MM-DD`。未填写时人生进度显示 `--%`。 |
| Lifespan in years / 预期寿命（年） | `85` | 人生进度条的分母。 |
| Week starts on / 一周起始日 | `monday` | `monday`、`sunday` 或 `saturday`，同时决定周进度的分界与日历的首列。 |
| Quote source tag / 语录来源标签 | `quotes` | 语录来源标签名。可以写 `quotes`、`#quotes` 或 `[[Quotes]]`（大小写不敏感）。留空表示关闭语录组件。 |
| Show day / week / year / life / calendar / quote widget | 全部开启 | 分别控制六个组件是否显示。 |

组件开关的设置键在 phase 2 从 `show<Id>Progress` 改名为 `show<Id>Widget`（"进度"已经不适用于日历和语录）。插件首次启动时会把旧键的值搬到新键，并写入 `settingsVersion: 2` 作为一次性标记，之后旧键不再参与判断——所以既有配置不会被重置，之后改动新键也不会被旧值覆盖回去。旧键会保留在设置文件里，以便回退到旧版本。

不合法的值会退回默认值，而不是把无效内容写进 CSS。`~` 开头的路径无法在插件沙箱中展开，会被视为未设置——请填写完整绝对路径。

### 壁纸是怎么读到本机文件的

Logseq 桌面端把 `assets://` 注册为特权协议（`standard`、`secure`、`bypassCSP`、`supportFetchAPI`、`streaming`），其 Electron 处理函数会剥掉 `assets://` 前缀、`decodeURIComponent` 之后按绝对路径直接读文件。所以：

- 绝对路径 → 插件转成 `assets:///绝对/路径`（逐段 percent-encode，空格与 `#` 都安全）；
- 图谱相对路径 → 交给 `logseq.Assets.makeUrl()`，由 Logseq 解析到当前 DB graph 的 `assets` 目录。

`file://` 不在特权协议列表中，渲染进程运行在 `lsp://logseq.com` 源上，因此 `file://` 子资源会被拦截——`assets://` 才是可行路径。

### 横幅怎么判断"当前是日志视图"，又挂在哪里

判断依据来自宿主状态，不是 URL 字符串：

- 路由名 `logseq.App.getStateFromStore(['route-match', 'data', 'name'])`：`home`、`allJournals` 是日志流，`page` 是 `/page/:name`。注意必须按路径取值——整个 `route-match` 无法跨插件桥序列化，请求它只会超时。
- 当前页面 `logseq.Editor.getCurrentPage()`：Logseq 2.0.1 的 DB graph 页面实体上既没有 `journal?` 也没有 `type`（与类型声明不符），只有日志页面带 `journalDay`（形如 `20260725`）。

判断逻辑集中在 `src/journal.ts` 的纯函数 `shouldMountBanner` 中，可脱离宿主单测。

挂载点是 `#main-content-container .cp__sidebar-main-content`，而不是 `#main-content-container` 本身：后者是 `display: flex; flex-direction: row` 的滚动容器，唯一的 flex 子元素就是内容列（`flex: 1 1 0%`），把横幅插进去会让它变成内容列的兄弟 flex item，把内容列压成零宽度。（右侧栏 `#right-sidebar` 在 `#app-container` 下，是该滚动容器的兄弟节点，从外部挤窄内容列。）注入的 CSS 全部以 `#lsdb-banner` 开头，不改宿主容器样式。

### 从源码安装

要求 Node.js `^20.19.0 || ^22.13.0 || >=24.0.0`（即 20.19.0 起的 20.x、22.13.0 起的 22.x，或 24 以上）。这条范围与 `package.json` 的 `engines.node` 一致，来自开发依赖 `jsdom` 的要求；版本不符时 `npm ci` 会直接报版本错误。

```bash
npm ci
npm run check   # 测试 + 类型检查 + 构建到 dist/
```

1. 在 Logseq 中开启 Developer Mode。
2. 打开 `Plugins`，选择 `Load unpacked plugin`。
3. 选择本仓库根目录（包含 `package.json` 与构建产物 `dist/`）。

改动源码后执行 `npm run build`，再在 Logseq 中 Reload 插件。持续构建用 `npm run dev`。

### 新增组件

`src/widgets.ts` 里的 `widgetDefinitions` 是唯一的组件清单。追加一个描述符即可，`banner.ts` 不需要改：

- `build(context, data)` 是纯函数，返回 `src/view.ts` 里的 `WidgetNode` 树（普通数据，因此可以直接单测）；返回 `null` 表示"无内容"，该组件就不渲染。
- 需要读图谱的组件再实现 `request(context)`，返回 `{ key, ttlMs, load(host) }`：运行时按 `key` 与 `ttlMs` 缓存，渲染时同步读缓存，加载在后台进行。
- 需要点击行为时，在节点上挂 `action`（如 `{ kind: 'openJournalDay', day }`）；渲染层用事件委托统一分发，组件自己不加监听器。
- `group` 决定组件落在哪张卡片上：`'calendar'` 或 `'panel'`（默认）。渲染层按组件 id 与卡片 id 做 keyed 复用，组件出现或消失都不会重建邻居的 DOM。
- 可见性设置项按 `show<Id>Widget` 自动生成。

## English

A banner plugin for **Logseq DB graphs**. It renders a strip at the top of a journal
view's content column: your own wallpaper as the background, with two frosted-glass cards
on top — the month calendar on the left, the four time-progress bars and the quote of the
day on the right.

### Features

- **Journal views only.** The banner appears on the journals feed (the scrolling
  multi-day view) and on a single journal page. Normal pages, all-pages, settings,
  graph view, whiteboards and plugin pages get none; leaving a journal removes the
  banner and returning re-renders it.
- **Local wallpaper** from an absolute path on your machine, an `https://` URL, or a
  path relative to the graph's `assets` folder. Fit and position are configurable, and
  a missing or unreadable image falls back to a gradient while the widgets stay readable.
- **Two cards, one surface.** The calendar sits on the left, the progress bars stack on
  the right, and each card is only as large as its own content — they no longer stretch
  across the banner, so bare wallpaper shows around and between them. They share one type
  scale, one spacing rhythm, one corner radius and one accent — the same colour marks
  "today" in the calendar and fills the progress bars. The scrim is thin (20% of the theme
  background) over a `blur(20px)` frost, so the wallpaper reads clearly *through* a card;
  legibility comes from a **glyph halo** instead — a `text-shadow` in the theme's
  background colour, which is a scrim the size of each glyph and leaves the space between
  glyphs transparent. Their colours come from Logseq's own theme variables
  (`--ls-primary-background-color`, `--ls-primary-text-color`, `--lx-accent-11`), so light
  and dark themes both work with no hard-coded palette.
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
- **A quote of the day** at the foot of the progress card — it is a reading like the
  bars are, so it belongs on the same card rather than as a third loose block. Collected
  from the top-level blocks of *every* page carrying a
  configurable tag (`quotes` by default). The pick is a date-seeded hash, so it is the
  same all day — a re-mount cannot reshuffle it — and different on another day. A missing
  tag, a page without top-level blocks or a failed query degrades quietly: no widget, no
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
leaves a broad expanse of wallpaper: the two cards cover about 35% of the banner's area,
where the full-width layout covered 88%. That height is a *minimum*: set it shorter and
the banner grows to whatever its content needs instead of clipping or overlapping.

### DB graphs only

`package.json` declares `logseq.unsupportedGraphType: "file"`, so Logseq will not enable
the plugin on a file graph. At startup it also calls `logseq.App.checkCurrentIsDbGraph()`
and exits with a warning if the current graph is not a DB graph.

### Settings

Configure these under `Settings → Plugin Settings → DB Banner`:

| Setting | Default | Notes |
| --- | --- | --- |
| Wallpaper source | empty | An absolute local path (`/Users/me/Pictures/wall.jpg`), an `https://` URL, a `data:` URI, or a graph-relative path (`../assets/wall.jpg`). Empty, `false`, `none` and `off` all mean "no wallpaper". |
| Wallpaper fit | `cover` | `cover`, `contain` or `tile`. |
| Wallpaper position | `50% 50%` | CSS `background-position`, for example `center top`. |
| Banner height | `280px` | A CSS length such as `280px` or `32vh`. It is a minimum — a value too small for the cards makes the banner grow rather than clip. |
| Birth date | empty | `YYYY-MM-DD`. Without it the life widget shows `--%`. |
| Lifespan in years | `85` | Denominator of the life-progress bar. |
| Week starts on | `monday` | `monday`, `sunday` or `saturday`; sets the week-progress boundary and the calendar's first column. |
| Quote source tag | `quotes` | Name of the tag whose pages hold the quotes. `quotes`, `#quotes` and `[[Quotes]]` all work, case-insensitively. Empty turns the quote widget off. |
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

### How the wallpaper reaches a local file

Logseq's desktop shell registers `assets://` as a privileged scheme (`standard`,
`secure`, `bypassCSP`, `supportFetchAPI`, `streaming`). Its Electron handler strips the
`assets://` prefix, runs `decodeURIComponent`, and serves the remainder as an absolute
filesystem path. So:

- an absolute path becomes `assets:///absolute/path`, percent-encoded per segment so
  spaces and `#` are safe — the same shape Logseq's own `make_asset_url` produces;
- a graph-relative path is handed to `logseq.Assets.makeUrl()`, which resolves it inside
  the current DB graph's `assets` folder.

`file://` is not privileged and the renderer runs on the `lsp://logseq.com` origin, so
`file://` subresources are blocked — `assets://` is the mechanism that works.

### How a journal view is recognised, and where the banner mounts

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

### Install from source

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

### Adding a widget

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
