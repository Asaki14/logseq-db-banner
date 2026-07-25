/**
 * Styles injected into the host app through `logseq.provideStyle`. Kept as a
 * TypeScript string so the build needs no CSS asset plumbing.
 *
 * `provideStyle` is global to the host document, so every rule stays scoped to
 * `#lsdb-banner`.
 */

export const bannerStyles = `
#lsdb-banner {
  position: relative;
  width: 100%;
  /* A minimum, not a fixed height: the widget panel is in normal flow, so a
     narrow content column that wraps it grows the banner instead of clipping. */
  min-height: var(--lsdb-banner-height, 220px);
  margin-bottom: 12px;
  padding: 14px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  align-items: flex-end;
  border-radius: 8px;
  overflow: hidden;
  isolation: isolate;
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

#lsdb-banner .lsdb-banner__widgets {
  position: relative;
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  align-items: flex-end;
  gap: 10px 14px;
  max-width: 100%;
  padding: 10px 12px;
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.42);
  backdrop-filter: blur(6px);
  color: #fff;
  font-size: 12px;
  line-height: 1.25;
}

#lsdb-banner .lsdb-banner__widgets:empty {
  display: none;
}

#lsdb-banner .lsdb-widget {
  flex: 0 0 auto;
  min-width: 0;
}

#lsdb-banner .lsdb-widget--progress {
  min-width: 108px;
}

#lsdb-banner .lsdb-widget__head {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  font-variant-numeric: tabular-nums;
}

#lsdb-banner .lsdb-widget__label {
  font-weight: 600;
  letter-spacing: 0.02em;
}

#lsdb-banner .lsdb-widget__track {
  margin: 4px 0 2px;
  height: 4px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.28);
  overflow: hidden;
}

#lsdb-banner .lsdb-widget__bar {
  height: 100%;
  width: 0;
  border-radius: inherit;
  background: #fff;
  transition: width 0.4s ease;
}

#lsdb-banner .lsdb-widget__detail {
  opacity: 0.75;
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}

/* Calendar ------------------------------------------------------------- */

#lsdb-banner .lsdb-widget--calendar .lsdb-widget__head {
  justify-content: center;
  margin-bottom: 4px;
}

#lsdb-banner .lsdb-calendar {
  display: grid;
  grid-template-columns: repeat(7, 18px);
  gap: 1px;
  font-size: 10px;
  font-variant-numeric: tabular-nums;
}

#lsdb-banner .lsdb-calendar__weekday,
#lsdb-banner .lsdb-calendar__pad,
#lsdb-banner .lsdb-calendar__day {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 16px;
  border-radius: 4px;
}

#lsdb-banner .lsdb-calendar__weekday {
  opacity: 0.6;
  font-weight: 600;
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
  background: rgba(255, 255, 255, 0.24);
}

#lsdb-banner .lsdb-calendar__day[data-today='true'] {
  background: rgba(255, 255, 255, 0.9);
  color: #111;
  font-weight: 700;
}

/* The has-content marker. */
#lsdb-banner .lsdb-calendar__day[data-content='true']::after {
  content: '';
  position: absolute;
  bottom: 1px;
  left: 50%;
  transform: translateX(-50%);
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: currentColor;
}

/* Quote ---------------------------------------------------------------- */

#lsdb-banner .lsdb-widget--quote {
  flex: 0 1 240px;
  max-width: 260px;
  align-self: stretch;
  display: flex;
  align-items: flex-end;
}

#lsdb-banner .lsdb-quote__text {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 4;
  /* Belt and braces: the clamp bounds the height in Chromium, the max-height
     bounds it anywhere else, and a single long word can never widen the panel. */
  max-height: 5.2em;
  overflow: hidden;
  overflow-wrap: anywhere;
  font-size: 11px;
  line-height: 1.3;
  font-style: italic;
  opacity: 0.92;
}
`
