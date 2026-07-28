import { describe, expect, it } from 'vitest'
import { settingsFields, settingsGroups, toSettingsSchema } from './fields'
import { widgetVisibilityKey } from './settings'
import { widgetDefinitions } from './widgets'

function field(key: string) {
  const found = settingsFields.find((candidate) => candidate.key === key)
  if (!found) throw new Error(`no field for ${key}`)
  return found
}

describe('settings fields', () => {
  it('covers every setting the banner reads, and no other', () => {
    expect(settingsFields.map(({ key }) => key)).toEqual([
      'wallpaperSource',
      'wallpaperFit',
      'wallpaperPosition',
      'bannerHeight',
      'birthDate',
      'lifespanYears',
      'weekStart',
      'quoteTag',
      ...widgetDefinitions.map(({ id }) => widgetVisibilityKey(id)),
    ])
  })

  it('gives the popover a label for every field', () => {
    for (const candidate of settingsFields) {
      expect(candidate.label).not.toBe('')
      expect(candidate.title).not.toBe('')
    }
  })

  it('accepts an empty value, and rejects one the parsers would discard', () => {
    const height = field('bannerHeight')
    expect(height.isValid?.('')).toBe(true)
    expect(height.isValid?.('24vh')).toBe(true)
    expect(height.isValid?.('tall')).toBe(false)

    const birthDate = field('birthDate')
    expect(birthDate.isValid?.('')).toBe(true)
    expect(birthDate.isValid?.('1990-02-11')).toBe(true)
    expect(birthDate.isValid?.('1990-02-30')).toBe(false)

    const position = field('wallpaperPosition')
    expect(position.isValid?.('center top')).toBe(true)
    expect(position.isValid?.('middle')).toBe(false)
  })
})

describe('toSettingsSchema', () => {
  const schema = toSettingsSchema()

  it('opens every group with its heading', () => {
    for (const group of settingsGroups) {
      const index = schema.findIndex(({ key }) => key === group.key)
      expect(index).toBeGreaterThanOrEqual(0)
      expect(schema[index].type).toBe('heading')
      expect(schema[index].title).toBe(group.title)
      expect(schema[index + 1].key).toBe(group.fields[0].key)
    }
  })

  it('maps each field kind onto the type the pane renders', () => {
    const entry = (key: string) => schema.find((item) => item.key === key)

    expect(entry('wallpaperSource')).toMatchObject({ type: 'string', default: '' })
    expect(entry('lifespanYears')).toMatchObject({ type: 'number', default: 85 })
    expect(entry('wallpaperFit')).toMatchObject({
      type: 'enum',
      enumPicker: 'radio',
      enumChoices: ['cover', 'contain', 'tile'],
      default: 'cover',
    })
    expect(entry('weekStart')).toMatchObject({
      type: 'enum',
      enumPicker: 'select',
      enumChoices: ['monday', 'sunday', 'saturday'],
    })
    expect(entry(widgetVisibilityKey('calendar'))).toMatchObject({
      type: 'boolean',
      default: true,
    })
  })
})
