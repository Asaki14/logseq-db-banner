/**
 * Styles injected into the host app through `logseq.provideStyle`. Kept as a
 * TypeScript string so the build needs no CSS asset plumbing.
 *
 * `provideStyle` is global to the host document, so every rule stays scoped to
 * `#lsdb-banner`.
 *
 * The banner is one surface, not a row of widgets: two frosted cards — the month
 * grid on the left, the progress bars and the quote on the right — sharing one
 * type scale, one corner radius, one gap and one accent. Colours come from the
 * host's own theme variables (`--ls-*`, `--lx-accent-11`), blended with
 * `color-mix`, so light and dark themes are followed without a theme selector and
 * without hard-coded palettes; the fallbacks only apply if a theme drops a
 * variable.
 */

export const bannerStyles = `
#lsdb-banner {
  --lsdb-gap: 12px;
  --lsdb-radius: 14px;
  --lsdb-accent: var(--lx-accent-11, #6aa9d8);
  --lsdb-surface: color-mix(
    in srgb,
    var(--ls-primary-background-color, #10131a) 58%,
    transparent
  );
  --lsdb-ink: var(--ls-primary-text-color, #eceff4);
  --lsdb-hairline: color-mix(in srgb, var(--lsdb-ink) 18%, transparent);

  position: relative;
  width: 100%;
  /* A minimum, not a fixed height: the cards are in normal flow, so a narrow
     content column that wraps them grows the banner instead of clipping. */
  min-height: var(--lsdb-banner-height, 360px);
  margin-bottom: 14px;
  padding: 14px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  border-radius: var(--lsdb-radius);
  overflow: hidden;
  isolation: isolate;
  color: var(--lsdb-ink);
  font-size: 12px;
  line-height: 1.3;
}

#lsdb-banner .lsdb-banner__image {
  position: absolute;
  inset: 0;
  background-image: var(--lsdb-wallpaper, none);
  background-position: var(--lsdb-wallpaper-position, 50% 50%);
  background-repeat: no-repeat;
  background-size: cover;
}

#lsdb-banner.lsdb-fit-contain .lsdb-banner__image {
  background-size: contain;
}

#lsdb-banner.lsdb-fit-tile .lsdb-banner__image {
  background-size: auto;
  background-repeat: repeat;
}

/* Shown when the wallpaper is unset or failed to load. */
#lsdb-banner.lsdb-banner--fallback .lsdb-banner__image {
  background-image: linear-gradient(
    135deg,
    var(--ls-secondary-background-color, #3b4252),
    var(--ls-tertiary-background-color, #4c566a)
  );
}

/* Cards ---------------------------------------------------------------- */

#lsdb-banner .lsdb-banner__widgets {
  position: relative;
  flex: 1;
  display: flex;
  flex-wrap: wrap;
  align-items: stretch;
  gap: var(--lsdb-gap);
  min-height: 0;
}

#lsdb-banner .lsdb-banner__widgets:empty {
  display: none;
}

#lsdb-banner .lsdb-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
  padding: 12px 14px;
  box-sizing: border-box;
  border: 1px solid var(--lsdb-hairline);
  border-radius: var(--lsdb-radius);
  background: var(--lsdb-surface);
  backdrop-filter: blur(16px) saturate(140%);
  -webkit-backdrop-filter: blur(16px) saturate(140%);
  box-shadow: 0 2px 14px rgba(0, 0, 0, 0.18);
}

#lsdb-banner .lsdb-card:empty {
  display: none;
}

/* The month grid keeps its natural width; the panel takes the rest. */
#lsdb-banner .lsdb-card--calendar {
  flex: 0 1 auto;
  width: clamp(212px, 32%, 288px);
}

#lsdb-banner .lsdb-card--panel {
  flex: 1 1 210px;
  /* Spread the bars through the card the way the month grid spreads its rows,
     so both cards breathe on the same rhythm however tall the banner is. */
  justify-content: space-between;
  gap: 12px;
}

/* Widgets -------------------------------------------------------------- */

#lsdb-banner .lsdb-widget {
  min-width: 0;
}

#lsdb-banner .lsdb-widget__head {
  display: flex;
  align-items: baseline;
  gap: 8px;
  font-variant-numeric: tabular-nums;
}

#lsdb-banner .lsdb-widget__label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 600;
  letter-spacing: 0.02em;
}

#lsdb-banner .lsdb-widget__detail {
  opacity: 0.62;
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}

#lsdb-banner .lsdb-widget__percent {
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

#lsdb-banner .lsdb-widget__track {
  margin-top: 5px;
  height: 5px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--lsdb-ink) 16%, transparent);
  overflow: hidden;
}

#lsdb-banner .lsdb-widget__bar {
  height: 100%;
  width: 0;
  border-radius: inherit;
  background: var(--lsdb-accent);
  transition: width 0.4s ease;
}

/* Calendar ------------------------------------------------------------- */

#lsdb-banner .lsdb-widget--calendar {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 0;
}

#lsdb-banner .lsdb-widget--calendar .lsdb-widget__head {
  justify-content: center;
}

#lsdb-banner .lsdb-widget--calendar .lsdb-widget__label {
  flex: 0 1 auto;
  text-align: center;
  font-size: 13px;
}

#lsdb-banner .lsdb-calendar {
  flex: 1;
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  /* Rows grow with the banner up to a comfortable cell, then the grid spreads
     the slack between them rather than stretching a date into a tall slab. */
  grid-auto-rows: minmax(20px, 34px);
  align-content: space-evenly;
  gap: 2px;
  font-variant-numeric: tabular-nums;
}

#lsdb-banner .lsdb-calendar__weekday,
#lsdb-banner .lsdb-calendar__pad,
#lsdb-banner .lsdb-calendar__day {
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
}

#lsdb-banner .lsdb-calendar__weekday {
  opacity: 0.55;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.04em;
}

#lsdb-banner .lsdb-calendar__day {
  position: relative;
  margin: 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  line-height: 1;
  cursor: pointer;
}

#lsdb-banner .lsdb-calendar__day:hover {
  background: color-mix(in srgb, var(--lsdb-ink) 16%, transparent);
}

/* The one accent, shared with the progress fills. */
#lsdb-banner .lsdb-calendar__day[data-today='true'] {
  background: var(--lsdb-accent);
  color: var(--ls-primary-background-color, #10131a);
  font-weight: 700;
}

/* The has-content marker. */
#lsdb-banner .lsdb-calendar__day[data-content='true']::after {
  content: '';
  position: absolute;
  bottom: 2px;
  left: 50%;
  transform: translateX(-50%);
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: currentColor;
  opacity: 0.75;
}

#lsdb-banner .lsdb-calendar__day[data-today='true'][data-content='true']::after {
  opacity: 0.9;
}

/* Quote ---------------------------------------------------------------- */

#lsdb-banner .lsdb-widget--quote {
  padding-top: 10px;
  border-top: 1px solid var(--lsdb-hairline);
}

#lsdb-banner .lsdb-quote__text {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
  /* Belt and braces: the clamp bounds the height in Chromium, the max-height
     bounds it anywhere else, and a single long word can never widen the card. */
  max-height: 4.2em;
  overflow: hidden;
  overflow-wrap: anywhere;
  font-size: 11.5px;
  line-height: 1.4;
  font-style: italic;
  opacity: 0.85;
}
`
