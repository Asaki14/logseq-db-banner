import { describe, expect, it } from 'vitest'
import { decodeAction, encodeAction } from './view'

describe('widget actions', () => {
  it('round-trips an action through its attribute form', () => {
    const action = { kind: 'openJournalDay', day: 20260725 } as const
    expect(decodeAction(encodeAction(action))).toEqual(action)
  })

  it('rejects anything that is not an action', () => {
    expect(decodeAction(undefined)).toBeNull()
    expect(decodeAction('')).toBeNull()
    expect(decodeAction('not json')).toBeNull()
    expect(decodeAction('null')).toBeNull()
    expect(decodeAction('42')).toBeNull()
    expect(decodeAction(JSON.stringify({ day: 20260725 }))).toBeNull()
    expect(decodeAction(JSON.stringify({ kind: 'rm -rf', day: 1 }))).toBeNull()
  })

  it('rejects a day that is not a positive whole number', () => {
    const withDay = (day: unknown) =>
      decodeAction(JSON.stringify({ kind: 'openJournalDay', day }))
    expect(withDay('20260725')).toBeNull()
    expect(withDay(0)).toBeNull()
    expect(withDay(-20260725)).toBeNull()
    expect(withDay(2026.5)).toBeNull()
  })
})
