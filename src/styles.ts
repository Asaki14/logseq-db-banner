/**
 * Styles injected into the host app through `logseq.provideStyle`. Kept as a
 * TypeScript string so the build needs no CSS asset plumbing.
 */

export const bannerStyles = `
#lsdb-banner {
  position: relative;
  width: 100%;
  height: var(--lsdb-banner-height, 220px);
  margin-bottom: 12px;
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
  position: absolute;
  right: 14px;
  bottom: 14px;
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  max-width: calc(100% - 28px);
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
  min-width: 108px;
  flex: 0 0 auto;
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
`
