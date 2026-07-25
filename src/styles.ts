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
 *
 * The cards are meant to be seen *through*, so the scrim is barely there, the
 * cards are held together by their edge rather than their fill, and legibility
 * comes from a halo drawn in the theme's background colour behind every
 * glyph. That pairing is what makes one value work on any wallpaper: the theme
 * always pairs light ink with a dark background and vice versa, so the halo is
 * always the opposite of the text and dark ink stays readable over a night
 * photograph exactly as light ink stays readable over a bright one.
 */

export const bannerStyles = `
#lsdb-banner {
  --lsdb-gap: 12px;
  --lsdb-radius: 14px;
  --lsdb-accent: var(--lx-accent-11, #6aa9d8);
  --lsdb-surface: color-mix(
    in srgb,
    var(--ls-primary-background-color, #10131a) 7%,
    transparent
  );
  --lsdb-ink: var(--ls-primary-text-color, #eceff4);
  --lsdb-hairline: color-mix(in srgb, var(--lsdb-ink) 26%, transparent);
  /* The glyph halo, and the fill of anything that has to read as a surface. */
  --lsdb-halo: var(--ls-primary-background-color, #10131a);
  /* The card edge, drawn the way the glyphs are: an ink hairline paired with a
     background-coloured line just inside it, so the pair keeps a visible seam on
     a wallpaper of any brightness without thickening into a frame. */
  --lsdb-card-edge: color-mix(in srgb, var(--lsdb-halo) 42%, transparent);
  /* The legibility device, in place of an opaque card: a tight ring stacked
     twice — so it is effectively solid — is a scrim the size of the glyph, and a
     wide soft ring lifts the whole line off a busy wallpaper. Between the glyphs
     the card stays as transparent as its scrim. */
  --lsdb-text-halo: 0 0 3px var(--lsdb-halo), 0 0 3px var(--lsdb-halo),
    0 1px 4px var(--lsdb-halo),
    0 0 10px color-mix(in srgb, var(--lsdb-halo) 65%, transparent);

  position: relative;
  width: 100%;
  /* A minimum, not a fixed height: the cards are in normal flow, so a narrow
     content column that wraps them grows the banner instead of clipping. */
  min-height: var(--lsdb-banner-height, 280px);
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

/* Cards sit at the top and keep their own height, so the wallpaper shows below
   them and to their right instead of being covered edge to edge. */
#lsdb-banner .lsdb-banner__widgets {
  position: relative;
  flex: 0 0 auto;
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: var(--lsdb-gap);
  min-height: 0;
}

#lsdb-banner .lsdb-banner__widgets:empty {
  display: none;
}

#lsdb-banner .lsdb-card {
  display: flex;
  flex-direction: column;
  gap: 9px;
  min-width: 0;
  padding: 10px 12px;
  box-sizing: border-box;
  border: 1px solid var(--lsdb-hairline);
  border-radius: var(--lsdb-radius);
  /* Barely a scrim, barely a blur: what defines the card is its edge, not its
     fill, so the wallpaper reads through nearly untouched. Legibility is the
     glyph halo's job — see --lsdb-text-halo. */
  background: var(--lsdb-surface);
  backdrop-filter: blur(2px) saturate(112%);
  -webkit-backdrop-filter: blur(2px) saturate(112%);
  box-shadow: inset 0 0 0 1px var(--lsdb-card-edge),
    0 1px 6px color-mix(in srgb, var(--lsdb-halo) 22%, transparent);
  text-shadow: var(--lsdb-text-halo);
}

#lsdb-banner .lsdb-card:empty {
  display: none;
}

/* Both cards are as wide as their content asks for, never wider. */
#lsdb-banner .lsdb-card--calendar {
  flex: 0 0 auto;
}

#lsdb-banner .lsdb-card--panel {
  flex: 0 1 auto;
  width: clamp(190px, 34%, 250px);
  gap: 9px;
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
  font-weight: 700;
  letter-spacing: 0.02em;
}

/* Only ever carries the "not configured" note; empty otherwise. */
#lsdb-banner .lsdb-widget__hint {
  opacity: 0.72;
  font-size: 11px;
}

/* Fixed field, tabular figures: the third decimal turns over about once a
   second on the day bar, and must not shove the row around when it does. */
#lsdb-banner .lsdb-widget__percent {
  flex: 0 0 auto;
  width: 5.4em;
  text-align: right;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  font-feature-settings: 'tnum' 1;
}

#lsdb-banner .lsdb-widget__track {
  margin-top: 5px;
  height: 5px;
  border-radius: 999px;
  /* Background-coloured rather than ink-coloured, so the empty part of the bar
     reads as a surface over a bright wallpaper as well as a dark one. */
  background: color-mix(
    in srgb,
    var(--ls-primary-background-color, #10131a) 55%,
    transparent
  );
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
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  gap: 6px;
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

/* Fixed cells, so the card is exactly as big as a readable month and no bigger:
   the grid no longer stretches to whatever height the banner happens to have. */
#lsdb-banner .lsdb-calendar {
  flex: 0 0 auto;
  display: grid;
  grid-template-columns: repeat(7, 26px);
  grid-auto-rows: 24px;
  align-content: start;
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
  opacity: 0.72;
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
  font-weight: 600;
  line-height: 1;
  cursor: pointer;
  /* Restated rather than inherited: the host stylesheet resets text-shadow on
     every button, and a direct rule beats what the card hands down. */
  text-shadow: var(--lsdb-text-halo);
}

#lsdb-banner .lsdb-calendar__day:hover {
  background: color-mix(in srgb, var(--lsdb-ink) 16%, transparent);
}

/* The one accent, shared with the progress fills. */
#lsdb-banner .lsdb-calendar__day[data-today='true'] {
  background: var(--lsdb-accent);
  color: var(--ls-primary-background-color, #10131a);
  font-weight: 700;
  /* The glyph is already the halo's colour; a halo would erase it. */
  text-shadow: none;
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
  /* The dot is painted, not typed, so it needs the halo as a ring of its own. */
  box-shadow: 0 0 3px 1px var(--lsdb-halo);
  opacity: 0.9;
}

#lsdb-banner .lsdb-calendar__day[data-today='true'][data-content='true']::after {
  box-shadow: none;
  opacity: 1;
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
  opacity: 0.94;
}
`
