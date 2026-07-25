/**
 * Pure normalisation of the raw `logseq.settings` values. Nothing here touches
 * the Logseq runtime, so every rule below is unit tested.
 */

import type { WeekStart } from './progress'

export const DEFAULT_LIFESPAN_YEARS = 85
export const DEFAULT_BANNER_HEIGHT = '220px'
export const DEFAULT_WALLPAPER_POSITION = '50% 50%'

/** How a wallpaper setting maps onto something the browser can load. */
export type WallpaperSource =
  | { kind: 'none' }
  /** Already a usable URL (`https:`, `data:`, `assets:`, `file:` ...). */
  | { kind: 'url'; url: string }
  /** Absolute filesystem path; the runtime turns it into an `assets://` URL. */
  | { kind: 'localPath'; path: string }
  /** Graph-relative asset path, resolved through `logseq.Assets.makeUrl`. */
  | { kind: 'graphRelative'; path: string }

export type WallpaperFit = 'cover' | 'contain' | 'tile'

const URI_SCHEME_PATTERN = /^[a-z][a-z0-9+.-]*:/i
const WINDOWS_DRIVE_PATTERN = /^[a-z]:[\\/]/i
const CSS_LENGTH_PATTERN = /^\d+(?:\.\d+)?(?:px|em|rem|vh|vw|%)$/
const DATE_PATTERN = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/
/** A CSS `background-position`: one or two keyword/length components. */
const POSITION_PATTERN =
  /^(?:left|right|top|bottom|center|-?\d+(?:\.\d+)?(?:px|%|em|rem))(?:\s+(?:left|right|top|bottom|center|-?\d+(?:\.\d+)?(?:px|%|em|rem)))?$/i

const WEEK_START_BY_NAME: Record<string, WeekStart> = {
  sunday: 0,
  monday: 1,
  saturday: 6,
}

function asTrimmedString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

/**
 * Strip the wrapping quotes users add to keep Logseq from previewing a URL.
 * Mirrors the markdown-era plugin's `banner:: "http://..."` convention.
 */
function stripWrappingQuotes(value: string): string {
  return value.replace(/^"(.*)"$/s, '$1').replace(/^'(.*)'$/s, '$1').trim()
}

/**
 * Percent-encode a filesystem path for the `assets://` scheme. Logseq's Electron
 * handler strips `assets://` and `decodeURIComponent`s the remainder, so each
 * path segment is encoded individually — including the Windows drive colon,
 * which Chromium would otherwise mangle inside a standard-scheme URL.
 */
export function toAssetsUrl(path: string): string {
  const normalized = path.replace(/\\/g, '/')
  const absolute = WINDOWS_DRIVE_PATTERN.test(normalized)
    ? `/${normalized}`
    : normalized
  const encoded = absolute
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/')
  return `assets://${encoded}`
}

export function resolveWallpaperSource(value: unknown): WallpaperSource {
  const raw = stripWrappingQuotes(asTrimmedString(value))
  if (!raw || raw === 'false' || raw === 'none' || raw === 'off') {
    return { kind: 'none' }
  }
  // A Windows drive letter (`C:\...`) also matches the URI scheme shape, so the
  // path check has to come first.
  if (raw.startsWith('/') || WINDOWS_DRIVE_PATTERN.test(raw)) {
    return { kind: 'localPath', path: raw }
  }
  if (URI_SCHEME_PATTERN.test(raw)) return { kind: 'url', url: raw }
  // `~` is not expandable from the plugin sandbox — there is no reliable home
  // directory to substitute — so it is reported as unset rather than guessed at.
  if (raw.startsWith('~')) return { kind: 'none' }
  return { kind: 'graphRelative', path: raw }
}

/** Local midnight of a `YYYY-MM-DD` (or `YYYY/M/D`) date, or `null`. */
export function parseBirthDate(value: unknown): Date | null {
  const match = DATE_PATTERN.exec(asTrimmedString(value))
  if (!match) return null

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (month < 1 || month > 12 || day < 1 || day > 31) return null

  const date = new Date(year, month - 1, day)
  // Rejects impossible dates such as 2001-02-30, which `Date` would roll over.
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null
  }
  return date
}

export function parseLifespanYears(
  value: unknown,
  fallback = DEFAULT_LIFESPAN_YEARS,
): number {
  const raw = typeof value === 'number' ? value : Number(asTrimmedString(value))
  if (!Number.isFinite(raw) || raw <= 0 || raw > 200) return fallback
  return raw
}

export function parseWeekStart(value: unknown, fallback: WeekStart = 1): WeekStart {
  const name = asTrimmedString(value).toLowerCase()
  return WEEK_START_BY_NAME[name] ?? fallback
}

export function parseBoolean(value: unknown, fallback = true): boolean {
  if (typeof value === 'boolean') return value
  const name = asTrimmedString(value).toLowerCase()
  if (name === 'true') return true
  if (name === 'false') return false
  return fallback
}

export function parseWallpaperFit(
  value: unknown,
  fallback: WallpaperFit = 'cover',
): WallpaperFit {
  const name = asTrimmedString(value).toLowerCase()
  return name === 'cover' || name === 'contain' || name === 'tile'
    ? name
    : fallback
}

/** Accept only simple CSS lengths so the value cannot break out of the rule. */
export function parseCssLength(value: unknown, fallback: string): string {
  const raw = asTrimmedString(value)
  return CSS_LENGTH_PATTERN.test(raw) ? raw : fallback
}

export function parseWallpaperPosition(
  value: unknown,
  fallback = DEFAULT_WALLPAPER_POSITION,
): string {
  const raw = asTrimmedString(value)
  return POSITION_PATTERN.test(raw) ? raw : fallback
}
