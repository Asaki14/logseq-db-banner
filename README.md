# DB Banner

[中文](#中文) · [English](#english)

A page banner for **Logseq DB graphs**: a wallpaper from your own machine plus
time-progress widgets for the current day, week, year and your life.

## 中文

一个仅适用于 **Logseq DB graph** 的横幅插件。在日志页面内容区顶部渲染一条横幅：背景是本机壁纸，右下角是时间进度组件。

### 功能

- **仅日志页面**：横幅只出现在日志视图——日志主页（多天滚动流）与单个日志页面。普通页面、All pages、设置、图谱视角、白板、插件页面都不会渲染横幅；离开日志视图时横幅会被移除，返回时重新渲染。
- **本机壁纸**：支持本机绝对路径、`https://` 链接，或相对于图谱 `assets` 目录的路径。可设置填充方式与位置；图片缺失或无法读取时回退为渐变背景，组件仍然可读。
- **时间进度组件**：当天、本周、当年、人生四条进度条，各自显示百分比与剩余量。每秒自动刷新，无需手动刷新页面。
- **人生进度**：由出生日期与预期寿命（默认 85 年）计算。出生日期在未来时显示 0%，寿命已超出时显示 100%。
- 切换页面后横幅自动重新挂载。

日历组件与随机名言组件属于 phase 2，本版本不包含。

### 仅支持 DB graph

`package.json` 的 `logseq.unsupportedGraphType` 为 `"file"`，Logseq 不会在 file graph 上启用本插件。启动时还会再次调用 `logseq.App.checkCurrentIsDbGraph()`，若当前不是 DB graph 则提示并退出。

### 设置项

在 `Settings → Plugin Settings → DB Banner` 中配置：

| 设置 | 默认值 | 说明 |
| --- | --- | --- |
| Wallpaper source / 壁纸来源 | 空 | 本机绝对路径（如 `/Users/me/Pictures/wall.jpg`）、`https://` 链接、`data:` URI，或图谱相对路径（如 `../assets/wall.jpg`）。留空、`false`、`none`、`off` 均表示不使用壁纸。 |
| Wallpaper fit / 填充方式 | `cover` | `cover`、`contain` 或 `tile`。 |
| Wallpaper position / 图片位置 | `50% 50%` | CSS `background-position`，如 `center top`。 |
| Banner height / 横幅高度 | `220px` | CSS 长度，如 `220px`、`24vh`。 |
| Birth date / 出生日期 | 空 | `YYYY-MM-DD`。未填写时人生进度显示 `--%`。 |
| Lifespan in years / 预期寿命（年） | `85` | 人生进度条的分母。 |
| Week starts on / 一周起始日 | `monday` | `monday`、`sunday` 或 `saturday`，决定周进度的分界。 |
| Show day / week / year / life progress | 全部开启 | 分别控制四个组件是否显示。 |

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

`src/widgets.ts` 里的 `widgetDefinitions` 是唯一的组件清单。追加一个 `{ id, label, compute, unavailableHint }` 即可：设置项会按 `show<Id>Progress` 自动生成，渲染层直接遍历该清单，不需要改动横幅代码。

## English

A banner plugin for **Logseq DB graphs**. It renders a strip at the top of a journal
view's content column: your own wallpaper as the background, time-progress widgets in
the lower right corner.

### Features

- **Journal views only.** The banner appears on the journals feed (the scrolling
  multi-day view) and on a single journal page. Normal pages, all-pages, settings,
  graph view, whiteboards and plugin pages get none; leaving a journal removes the
  banner and returning re-renders it.
- **Local wallpaper** from an absolute path on your machine, an `https://` URL, or a
  path relative to the graph's `assets` folder. Fit and position are configurable, and
  a missing or unreadable image falls back to a gradient while the widgets stay readable.
- **Time-progress widgets** for the current day, week, year and life, each with a bar,
  a percentage and a remaining-time line. They refresh every second — no manual reload.
- **Life progress** is computed from a birth date and a lifespan (85 years by default).
  A birth date in the future reads 0%; an exceeded lifespan reads 100%.
- The banner re-attaches itself after page navigation.

The calendar widget and the random-quote widget are phase 2 and are not part of this release.

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
| Banner height | `220px` | A CSS length such as `220px` or `24vh`. |
| Birth date | empty | `YYYY-MM-DD`. Without it the life widget shows `--%`. |
| Lifespan in years | `85` | Denominator of the life-progress bar. |
| Week starts on | `monday` | `monday`, `sunday` or `saturday`; sets the week-progress boundary. |
| Show day / week / year / life progress | all on | Per-widget visibility. |

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

`widgetDefinitions` in `src/widgets.ts` is the single widget list. Append one
`{ id, label, compute, unavailableHint }` entry: its visibility setting is generated as
`show<Id>Progress`, and the renderer iterates the list, so the banner code stays untouched.

## License

[MIT](LICENSE)
