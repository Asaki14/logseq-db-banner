/**
 * Styles injected into the host app through `logseq.provideStyle`. Kept as a
 * TypeScript string so the build needs no CSS asset plumbing.
 *
 * `provideStyle` is global to the host document, so every rule stays scoped to
 * `#lsdb-banner`.
 *
 * The banner is one surface, not a row of widgets: two frosted cards of the same
 * width and height held apart at its two edges — the month grid at the left, the progress
 * bars and the quote at the right, wallpaper between them — sharing one type
 * scale, one corner radius, one gap and one accent.
 * The banner deliberately does *not* follow the host's light/dark theme: it is a
 * surface laid over an image, not part of the page. `--ls-primary-background-color`
 * is white in the light theme, so a scrim mixed from it lightened a dark
 * photograph almost not at all while the theme's dark ink sat on top of that dark
 * image — unreadable. The scrim and the ink are therefore constants, a dark glass
 * carrying light type, which works over any wallpaper in either theme. Only the
 * accent still comes from the theme (`--lx-accent-11`).
 *
 * The cards are still meant to be seen *through*, so the scrim stays light and
 * the cards are held together by their edge as much as their fill. Legibility is
 * paid for by the scrim plus one soft drop shadow — not by the omnidirectional
 * per-glyph halo this used to stack, which made the type glow.
 */

export const bannerStyles = `
#lsdb-banner {
  --lsdb-gap: 12px;
  --lsdb-radius: 14px;
  --lsdb-calendar-cell: 26px;
  --lsdb-calendar-cell-gap: 2px;
  --lsdb-card-padding-x: 12px;
  /* One width for both cards, and it is the month grid's: 7 cells, the 6 gaps
     between them, the card's own horizontal padding and its 1px border on each
     side. The panel has no natural width of its own, so it takes the calendar's
     rather than the calendar being stretched to meet it — the narrower of the
     two wins, so less wallpaper is covered and the pair reads as matched. */
  --lsdb-card-width: calc(
    7 * var(--lsdb-calendar-cell) + 6 * var(--lsdb-calendar-cell-gap) + 2 *
      var(--lsdb-card-padding-x) + 2px
  );
  --lsdb-accent: var(--lx-accent-11, #6aa9d8);
  /* Enough of a scrim to carry plain type on its own — the wallpaper still reads
     through it, but the ink no longer needs a halo to survive a busy photograph. */
  /* Dark glass, deliberately NOT the theme background: in the light theme that
     variable is white, and a white scrim over a dark photograph lightens almost
     nothing while the theme's dark ink sits on top of a dark image. A constant
     dark scrim with light ink is legible over any wallpaper in either theme. */
  --lsdb-surface: rgba(12, 15, 22, 0.3);
  --lsdb-ink: #f0f3f8;
  --lsdb-hairline: color-mix(in srgb, var(--lsdb-ink) 26%, transparent);
  /* The background colour: the fill of anything that has to read as a surface,
     and the colour the text shadow is drawn in. */
  --lsdb-halo: #0c0f16;
  /* The card edge, drawn as an ink hairline paired with a background-coloured line
     just inside it, so the pair keeps a visible seam on a wallpaper of any
     brightness without thickening into a frame. */
  --lsdb-card-edge: color-mix(in srgb, var(--lsdb-halo) 42%, transparent);
  /* One soft shadow under the glyph, not a ring around it: it separates the type
     from whatever the scrim lets through without the glow an omnidirectional halo
     gives every letter. */
  --lsdb-text-shadow: 0 1px 1px color-mix(
    in srgb,
    var(--lsdb-halo) 24%,
    transparent
  );

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

/* The row sits at the top and is only as tall as its own content, so the wallpaper
   shows below it and between the cards instead of being covered edge to edge.
   Inside the row the cards stretch, which is what makes their heights equal rather
   than merely similar: the row is as tall as the taller card's content and both
   cards take that height.
   space-between drives the cards to the row's two ends — the banner's own padding
   is the inset, so neither is flush against the border — and because neither card
   grows, all the spare room lands in the middle as wallpaper. The gap is then only
   a floor for a column too narrow to hold both, where the row wraps; a lone card
   (calendar hidden, or every panel widget off) sits at the left end, where the
   calendar sits when there are two. */
#lsdb-banner .lsdb-banner__widgets {
  position: relative;
  flex: 0 0 auto;
  display: flex;
  flex-wrap: wrap;
  align-items: stretch;
  justify-content: space-between;
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
  padding: 10px var(--lsdb-card-padding-x);
  box-sizing: border-box;
  border: 1px solid var(--lsdb-hairline);
  border-radius: var(--lsdb-radius);
  /* A light scrim over a light blur: the wallpaper still reads through the card,
     and between them they carry the type — see --lsdb-text-shadow. */
  background: var(--lsdb-surface);
  backdrop-filter: blur(4px) saturate(112%);
  -webkit-backdrop-filter: blur(4px) saturate(112%);
  box-shadow: inset 0 0 0 1px var(--lsdb-card-edge),
    0 1px 6px color-mix(in srgb, var(--lsdb-halo) 22%, transparent);
  text-shadow: var(--lsdb-text-shadow);
}

#lsdb-banner .lsdb-card:empty {
  display: none;
}

/* Both cards are as wide as their content asks for, never wider. */
#lsdb-banner .lsdb-card--calendar {
  flex: 0 0 auto;
}

/* Stretched to the month grid's height, its content spread over that height: the
   spare room goes between the bars and above the quote rather than pooling under
   the last one, and it works the same when the quote is hidden. */
#lsdb-banner .lsdb-card--panel {
  flex: 0 1 auto;
  width: var(--lsdb-card-width);
  gap: 9px;
  justify-content: space-between;
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

/* Never shrinks: the labels are single short words, and at the card's width the
   row has no room to spare, so the deficit has to come out of the hint instead
   of clipping "Week" to "We…". */
#lsdb-banner .lsdb-widget__label {
  flex: 0 0 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 700;
  letter-spacing: 0.02em;
}

/* Only ever carries the "not configured" note; empty otherwise — and empty is
   why it grows: it is the spacer that holds the percentage against the row's
   right edge now that the label no longer stretches. When it does carry text it
   is the one part of the row allowed to give way, on one line. */
#lsdb-banner .lsdb-widget__hint {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: right;
  opacity: 0.78;
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
  grid-template-columns: repeat(7, var(--lsdb-calendar-cell));
  grid-auto-rows: 24px;
  align-content: start;
  gap: var(--lsdb-calendar-cell-gap);
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
  opacity: 0.78;
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
  text-shadow: var(--lsdb-text-shadow);
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

/* Upright and full-strength rather than dimmed italic: the same words at the same
   size read as a sentence instead of a caption. */
#lsdb-banner .lsdb-quote__text {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
  /* Belt and braces: the clamp bounds the height in Chromium, the max-height
     bounds it anywhere else, and a single long word can never widen the card. */
  max-height: 4.5em;
  overflow: hidden;
  overflow-wrap: anywhere;
  font-size: 12px;
  line-height: 1.45;
}
`
