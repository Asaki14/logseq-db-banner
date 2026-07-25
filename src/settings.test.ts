import { describe, expect, it } from 'vitest'
import {
  DEFAULT_BANNER_HEIGHT,
  DEFAULT_LIFESPAN_YEARS,
  DEFAULT_WALLPAPER_POSITION,
  legacyWidgetVisibilityKey,
  parseBirthDate,
  parseBoolean,
  parseCssLength,
  parseLifespanYears,
  parseQuoteTag,
  parseWallpaperFit,
  parseWallpaperPosition,
  parseWeekStart,
  resolveWallpaperSource,
  resolveWidgetVisibility,
  toAssetsUrl,
  SETTINGS_VERSION,
  settingsMigration,
  widgetVisibilityKey,
} from './settings'

const WIDGET_IDS = ['day', 'week', 'year', 'life', 'calendar', 'quote']

/** The path from the Windows bug report, verbatim. */
const WINDOWS_PATH = 'D:\\桌面\\20260510第一赛段冠军!.jpg'

/**
 * The filesystem path Logseq's shell derives from an `assets://` URL, in the two
 * steps observed live against 2.0.1: Chromium's standard-scheme parser folds the
 * leading slashes into the host, then `setup-interceptor!`
 * (`electron/src/electron/core.cljs`) puts host and path back together minus the
 * scheme, restores the drive colon and decodes.
 */
function resolveLikeLogseq(url: string): string {
  const hostAndPath = url.replace(/^assets:\/+/, '')
  return decodeURIComponent(hostAndPath.replace('/logseq__colon/', ':/'))
}

describe('resolveWallpaperSource', () => {
  it('treats blank and disabling values as unset', () => {
    for (const value of ['', '   ', 'false', 'none', 'off', undefined, 42]) {
      expect(resolveWallpaperSource(value)).toEqual({ kind: 'none' })
    }
  })

  it('strips the quotes users add around URLs', () => {
    expect(resolveWallpaperSource('"https://example.com/a.jpg"')).toEqual({
      kind: 'url',
      url: 'https://example.com/a.jpg',
    })
    expect(resolveWallpaperSource("'/Users/me/a.jpg'")).toEqual({
      kind: 'localPath',
      path: '/Users/me/a.jpg',
    })
  })

  it('passes through anything that already has a scheme', () => {
    for (const url of [
      'https://example.com/a.jpg',
      'file:///Users/me/a.jpg',
      'assets:///Users/me/a.jpg',
      'data:image/png;base64,AAAA',
    ]) {
      expect(resolveWallpaperSource(url)).toEqual({ kind: 'url', url })
    }
  })

  it('recognises absolute POSIX and Windows paths', () => {
    expect(resolveWallpaperSource('/Users/me/Pictures/wall.jpg')).toEqual({
      kind: 'localPath',
      path: '/Users/me/Pictures/wall.jpg',
    })
    expect(resolveWallpaperSource('C:\\Users\\me\\wall.jpg')).toEqual({
      kind: 'localPath',
      path: 'C:\\Users\\me\\wall.jpg',
    })
  })

  it('treats everything else as a graph-relative asset path', () => {
    expect(resolveWallpaperSource('../assets/wall.jpg')).toEqual({
      kind: 'graphRelative',
      path: '../assets/wall.jpg',
    })
    expect(resolveWallpaperSource('assets/wall.jpg')).toEqual({
      kind: 'graphRelative',
      path: 'assets/wall.jpg',
    })
  })

  it('reports a tilde path as unset, since the sandbox cannot expand it', () => {
    expect(resolveWallpaperSource('~/Pictures/wall.jpg')).toEqual({ kind: 'none' })
  })
})

describe('toAssetsUrl', () => {
  it('builds a three-slash assets URL for a POSIX path', () => {
    expect(toAssetsUrl('/Users/me/Pictures/wall.jpg')).toBe(
      'assets:///Users/me/Pictures/wall.jpg',
    )
  })

  it('encodes each segment without escaping the separators', () => {
    expect(toAssetsUrl('/Users/me/My Pictures/wall #1.jpg')).toBe(
      'assets:///Users/me/My%20Pictures/wall%20%231.jpg',
    )
  })

  it('normalises a Windows path and carries the drive colon as a token', () => {
    // The drive letter ends up in the URL's host, where neither `%3A` nor a
    // literal colon survives, so it goes over as Logseq's own `logseq__colon`.
    expect(toAssetsUrl('C:\\Users\\me\\wall.jpg')).toBe(
      'assets:///C/logseq__colon/Users/me/wall.jpg',
    )
  })

  it('keeps a Windows path free of an encoded colon', () => {
    const url = toAssetsUrl(WINDOWS_PATH)
    expect(url).toBe(
      'assets:///D/logseq__colon/%E6%A1%8C%E9%9D%A2/' +
        '20260510%E7%AC%AC%E4%B8%80%E8%B5%9B%E6%AE%B5%E5%86%A0%E5%86%9B!.jpg',
    )
    expect(url).not.toMatch(/%3A/i)
  })

  it('round-trips through decodeURIComponent, as the host handler does', () => {
    const path = '/Users/me/My Pictures/wall #1.jpg'
    const decoded = decodeURIComponent(toAssetsUrl(path).replace('assets://', ''))
    expect(decoded).toBe(path)
  })

  it('round-trips a Windows drive, CJK segments and a `!` through the host', () => {
    expect(resolveLikeLogseq(toAssetsUrl(WINDOWS_PATH))).toBe(
      'D:/桌面/20260510第一赛段冠军!.jpg',
    )
  })
})

describe('parseBirthDate', () => {
  it('accepts dashed and slashed dates at local midnight', () => {
    const dashed = parseBirthDate('1990-05-17')
    expect(dashed).not.toBeNull()
    expect([
      dashed!.getFullYear(),
      dashed!.getMonth(),
      dashed!.getDate(),
      dashed!.getHours(),
    ]).toEqual([1990, 4, 17, 0])
    expect(parseBirthDate('1990/5/17')?.getDate()).toBe(17)
  })

  it('accepts a leap day', () => {
    const leapDay = parseBirthDate('2000-02-29')
    expect([leapDay?.getMonth(), leapDay?.getDate()]).toEqual([1, 29])
  })

  it('rejects impossible and malformed dates', () => {
    for (const value of [
      '',
      'yesterday',
      '1990-13-01',
      '1990-00-10',
      '1990-02-30',
      '2001-02-29',
      '1990-05-17T10:00',
      '90-05-17',
      undefined,
      12345,
    ]) {
      expect(parseBirthDate(value)).toBeNull()
    }
  })
})

describe('parseLifespanYears', () => {
  it('defaults to 85', () => {
    expect(DEFAULT_LIFESPAN_YEARS).toBe(85)
    expect(parseLifespanYears(undefined)).toBe(85)
    expect(parseLifespanYears('')).toBe(85)
  })

  it('accepts numbers and numeric strings', () => {
    expect(parseLifespanYears(90)).toBe(90)
    expect(parseLifespanYears('72.5')).toBe(72.5)
  })

  it('falls back for values outside a plausible range', () => {
    expect(parseLifespanYears(0)).toBe(85)
    expect(parseLifespanYears(-3)).toBe(85)
    expect(parseLifespanYears(500)).toBe(85)
    expect(parseLifespanYears('abc')).toBe(85)
    expect(parseLifespanYears(Number.NaN, 70)).toBe(70)
  })
})

describe('parseWeekStart', () => {
  it('maps names to day numbers, defaulting to Monday', () => {
    expect(parseWeekStart('monday')).toBe(1)
    expect(parseWeekStart('Sunday')).toBe(0)
    expect(parseWeekStart('saturday')).toBe(6)
    expect(parseWeekStart(undefined)).toBe(1)
    expect(parseWeekStart('funday')).toBe(1)
    expect(parseWeekStart('funday', 0)).toBe(0)
  })
})

describe('parseBoolean', () => {
  it('handles booleans, strings and fallbacks', () => {
    expect(parseBoolean(true)).toBe(true)
    expect(parseBoolean(false)).toBe(false)
    expect(parseBoolean('false')).toBe(false)
    expect(parseBoolean('TRUE')).toBe(true)
    expect(parseBoolean(undefined)).toBe(true)
    expect(parseBoolean(undefined, false)).toBe(false)
  })
})

describe('parseWallpaperFit', () => {
  it('accepts the three known modes only', () => {
    expect(parseWallpaperFit('cover')).toBe('cover')
    expect(parseWallpaperFit('CONTAIN')).toBe('contain')
    expect(parseWallpaperFit('tile')).toBe('tile')
    expect(parseWallpaperFit('stretch')).toBe('cover')
    expect(parseWallpaperFit(undefined, 'contain')).toBe('contain')
  })
})

describe('parseCssLength', () => {
  it('accepts simple lengths', () => {
    expect(parseCssLength('220px', DEFAULT_BANNER_HEIGHT)).toBe('220px')
    expect(parseCssLength('24vh', DEFAULT_BANNER_HEIGHT)).toBe('24vh')
    expect(parseCssLength('12.5rem', DEFAULT_BANNER_HEIGHT)).toBe('12.5rem')
  })

  it('rejects anything that could escape the CSS declaration', () => {
    expect(parseCssLength('220', DEFAULT_BANNER_HEIGHT)).toBe(DEFAULT_BANNER_HEIGHT)
    expect(parseCssLength('220px; color: red', DEFAULT_BANNER_HEIGHT)).toBe(
      DEFAULT_BANNER_HEIGHT,
    )
    expect(parseCssLength('calc(100% - 10px)', DEFAULT_BANNER_HEIGHT)).toBe(
      DEFAULT_BANNER_HEIGHT,
    )
    expect(parseCssLength(undefined, DEFAULT_BANNER_HEIGHT)).toBe(
      DEFAULT_BANNER_HEIGHT,
    )
  })
})

describe('parseWallpaperPosition', () => {
  it('accepts keyword and length positions', () => {
    expect(parseWallpaperPosition('50% 50%')).toBe('50% 50%')
    expect(parseWallpaperPosition('center top')).toBe('center top')
    expect(parseWallpaperPosition('left')).toBe('left')
    expect(parseWallpaperPosition('20px 40px')).toBe('20px 40px')
  })

  it('falls back for unsupported or unsafe values', () => {
    expect(parseWallpaperPosition('')).toBe(DEFAULT_WALLPAPER_POSITION)
    expect(parseWallpaperPosition('50% 50% 50%')).toBe(DEFAULT_WALLPAPER_POSITION)
    expect(parseWallpaperPosition('red; background: url(x)')).toBe(
      DEFAULT_WALLPAPER_POSITION,
    )
  })
})

describe('parseQuoteTag', () => {
  it('accepts the ways users write a tag', () => {
    expect(parseQuoteTag('quotes')).toBe('quotes')
    expect(parseQuoteTag('#quotes')).toBe('quotes')
    expect(parseQuoteTag('[[Quotes]]')).toBe('quotes')
    expect(parseQuoteTag('"My Quotes"')).toBe('my quotes')
    expect(parseQuoteTag('  Daily Quotes  ')).toBe('daily quotes')
  })

  it('reports an empty setting as no source at all', () => {
    for (const value of ['', '   ', '#', undefined, null, 42]) {
      expect(parseQuoteTag(value)).toBe('')
    }
  })
})

describe('widget visibility settings', () => {
  it('names the current and the phase 1 key for a widget', () => {
    expect(widgetVisibilityKey('day')).toBe('showDayWidget')
    expect(widgetVisibilityKey('calendar')).toBe('showCalendarWidget')
    expect(legacyWidgetVisibilityKey('day')).toBe('showDayProgress')
  })

  it('shows every widget when nothing is stored', () => {
    expect(resolveWidgetVisibility({}, WIDGET_IDS)).toEqual(new Set(WIDGET_IDS))
  })

  it('keeps honouring a saved phase 1 configuration', () => {
    const stored = {
      showDayProgress: true,
      showWeekProgress: false,
      showYearProgress: true,
      showLifeProgress: false,
    }
    expect(resolveWidgetVisibility(stored, WIDGET_IDS)).toEqual(
      new Set(['day', 'year', 'calendar', 'quote']),
    )
  })

  it('prefers the current key once it exists', () => {
    const stored = { showDayProgress: true, showDayWidget: false }
    expect(resolveWidgetVisibility(stored, ['day'])).toEqual(new Set())
  })

  it('reads a boolean stored as a string', () => {
    expect(resolveWidgetVisibility({ showDayWidget: 'false' }, ['day'])).toEqual(
      new Set(),
    )
  })

})

describe('settingsMigration', () => {
  it('carries a phase 1 configuration over to the current keys', () => {
    const stored = {
      showDayProgress: true,
      showWeekProgress: false,
      showYearProgress: true,
      showLifeProgress: false,
    }
    expect(settingsMigration(stored, WIDGET_IDS)).toEqual({
      settingsVersion: SETTINGS_VERSION,
      showDayWidget: true,
      showWeekWidget: false,
      showYearWidget: true,
      showLifeWidget: false,
    })
  })

  it('wins over the schema defaults the settings pane has already written', () => {
    // `useSettingsSchema` fills every new key in before the plugin can look, so
    // an unstamped configuration must take the legacy value regardless.
    const stored = { showWeekProgress: false, showWeekWidget: true }
    expect(settingsMigration(stored, ['week'])).toEqual({
      settingsVersion: SETTINGS_VERSION,
      showWeekWidget: false,
    })
  })

  it('only stamps the version for a fresh install', () => {
    expect(settingsMigration({}, WIDGET_IDS)).toEqual({
      settingsVersion: SETTINGS_VERSION,
    })
  })

  it('runs once, so a later choice is not reverted to the phase 1 value', () => {
    const stored = {
      settingsVersion: SETTINGS_VERSION,
      showWeekProgress: false,
      showWeekWidget: true,
    }
    expect(settingsMigration(stored, WIDGET_IDS)).toEqual({})
  })

  it('never invents a value for the widgets phase 1 did not have', () => {
    const patch = settingsMigration({ showDayProgress: false }, WIDGET_IDS)
    expect(Object.keys(patch).sort()).toEqual(['settingsVersion', 'showDayWidget'])
  })
})
