import { describe, expect, it } from 'vitest'
import { buildWidgetViews, widgetDefinitions, type WidgetContext } from './widgets'

const widgetIds = widgetDefinitions.map(({ id }) => id)

const context: WidgetContext = {
  now: new Date(2025, 6, 25, 12, 0), // Friday noon
  weekStart: 1,
  birthDate: new Date(1990, 0, 1),
  lifespanYears: 85,
}

const allVisible = () => true

describe('widget registry', () => {
  it('exposes exactly the phase 1 widgets, with no calendar or quote', () => {
    expect(widgetIds).toEqual(['day', 'week', 'year', 'life'])
  })

  it('gives every widget a unique id', () => {
    expect(new Set(widgetIds).size).toBe(widgetDefinitions.length)
  })
})

describe('buildWidgetViews', () => {
  it('renders a percentage and a bar width for each visible widget', () => {
    const views = buildWidgetViews(context, allVisible)
    expect(views.map((view) => view.id)).toEqual(['day', 'week', 'year', 'life'])

    const day = views[0]
    expect(day.label).toBe('Day')
    expect(day.percentText).toBe('50.0%')
    expect(day.barWidth).toBe('50.000%')
    expect(day.detail).toBe('12h left')
  })

  it('honours the visibility predicate and keeps registry order', () => {
    const views = buildWidgetViews(context, (id) => id === 'year' || id === 'day')
    expect(views.map((view) => view.id)).toEqual(['day', 'year'])
  })

  it('returns nothing when every widget is hidden', () => {
    expect(buildWidgetViews(context, () => false)).toEqual([])
  })

  it('uses the configured week start', () => {
    const monday = buildWidgetViews({ ...context, weekStart: 1 }, allVisible)[1]
    const sunday = buildWidgetViews({ ...context, weekStart: 0 }, allVisible)[1]
    expect(monday.percentText).not.toBe(sunday.percentText)
    expect(monday.detail).toBe('3d left')
    expect(sunday.detail).toBe('2d left')
  })

  it('marks the life widget unavailable without a birth date', () => {
    const life = buildWidgetViews({ ...context, birthDate: null }, allVisible)[3]
    expect(life.fraction).toBeNull()
    expect(life.percentText).toBe('--%')
    expect(life.barWidth).toBe('0%')
    expect(life.detail).toBe('set a birth date')
  })

  it('shows 0% for a birth date in the future', () => {
    const life = buildWidgetViews(
      { ...context, birthDate: new Date(2030, 0, 1) },
      allVisible,
    )[3]
    expect(life.percentText).toBe('0.0%')
    expect(life.barWidth).toBe('0.000%')
  })

  it('caps an exceeded lifespan at 100% and says so', () => {
    const life = buildWidgetViews(
      { ...context, birthDate: new Date(1900, 0, 1) },
      allVisible,
    )[3]
    expect(life.percentText).toBe('100.0%')
    expect(life.barWidth).toBe('100.000%')
    expect(life.detail).toBe('85y reached')
  })

  it('reports the remaining years of a normal lifespan', () => {
    const life = buildWidgetViews(context, allVisible)[3]
    expect(life.percentText).toBe('41.8%')
    expect(life.detail).toBe('49.4y left')
  })

  it('is 100% on the last day of a leap-year lifespan boundary', () => {
    // Born 29 February 2000 with an 85 year lifespan ends 1 March 2085.
    const reached = buildWidgetViews(
      { ...context, now: new Date(2085, 2, 1), birthDate: new Date(2000, 1, 29) },
      allVisible,
    )[3]
    expect(reached.percentText).toBe('100.0%')
  })
})
