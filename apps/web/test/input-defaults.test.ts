import { describe, expect, it } from 'vitest'
import { volumeNoteText } from '../src/components/workbench-outcome.ts'
import { english } from '../src/i18n/translate.ts'
import {
  barrelLengthByClass,
  cartridgeClass,
  type DefaultSources,
  suggestDefaults,
  volumeMeasured,
} from '../src/lib/input-defaults.ts'

const suggest = (sources: DefaultSources) => suggestDefaults(sources, english.t)

const capacity = { si: 3.9e-6, source: 'case capacity record' }
const cartridge = {
  name: '308 Win.',
  class: 'rifle' as const,
  boreDiameter: 0.00762,
  twist: 0.305,
  capacity,
}
const bullet = { name: 'Bravo 168', diameter: 0.00782 }
const gun = { name: 'Range rifle', twist: 0.254, barrelLength: 0.508 }

describe('the default of each field', () => {
  it('has none from nothing', () => {
    expect(suggest({})).toEqual({})
  })

  it('takes the case volume from the cartridge record only', () => {
    expect(suggest({ cartridge }).volume).toEqual(capacity)
    expect(suggest({ cartridge, firearm: gun, bullet, settingsBarrelLength: 0.4 }).volume).toEqual(
      capacity,
    )
    expect(suggest({ cartridge: { ...cartridge, capacity: undefined } }).volume).toBeUndefined()
    expect(suggest({ firearm: gun, bullet }).volume).toBeUndefined()
  })

  it('takes the bore area from the record chamber area Q, none without it', () => {
    expect(suggest({ cartridge: { ...cartridge, boreArea: 47.51e-6 } }).boreArea).toEqual({
      si: 47.51e-6,
      source: 'CIP bore area Q of 308 Win.',
    })
    expect(suggest({ cartridge, bullet }).boreArea).toBeUndefined()
  })

  it('takes the bore diameter from the record land diameter F, else from the bullet diameter', () => {
    expect(suggest({ cartridge, bullet }).boreDiameter).toEqual({
      si: 0.00762,
      source: 'CIP land diameter F of 308 Win.',
    })
    expect(
      suggest({ cartridge: { ...cartridge, boreDiameter: undefined }, bullet }).boreDiameter?.si,
    ).toBe(0.00782)
    expect(suggest({ bullet }).boreDiameter?.si).toBe(0.00782)
    expect(
      suggest({ cartridge: { ...cartridge, boreDiameter: undefined } }).boreDiameter,
    ).toBeUndefined()
  })

  it('takes the twist from the gun, else from the record u, never from a class', () => {
    expect(suggest({ cartridge, firearm: gun }).twist).toEqual({
      si: 0.254,
      source: 'your firearm Range rifle',
      fromFirearm: true,
    })
    expect(suggest({ cartridge }).twist).toEqual({
      si: 0.305,
      source: 'CIP twist u of 308 Win.',
    })
    // a gun without twist, or with the 0 of no rifling, leaves the record's
    expect(suggest({ cartridge, firearm: { name: 'Smooth' } }).twist?.si).toBe(0.305)
    expect(suggest({ cartridge, firearm: { name: 'Smooth', twist: 0 } }).twist?.si).toBe(0.305)
    // without a record the field stays empty (no common twist by caliber yet)
    expect(suggest({ bullet }).twist).toBeUndefined()
    expect(suggest({ cartridge: { ...cartridge, twist: undefined } }).twist).toBeUndefined()
  })

  it('takes the barrel length from the gun, else Settings, else the class', () => {
    expect(suggest({ cartridge, firearm: gun, settingsBarrelLength: 0.4 }).barrelLength).toEqual({
      si: 0.508,
      source: 'your firearm Range rifle',
      fromFirearm: true,
    })
    expect(suggest({ cartridge, settingsBarrelLength: 0.4 }).barrelLength).toEqual({
      si: 0.4,
      source: 'your default from Settings',
    })
    expect(suggest({ cartridge }).barrelLength).toEqual({
      si: barrelLengthByClass.rifle,
      source: 'rifle barrel, assumption, no source',
    })
    expect(suggest({ cartridge: { ...cartridge, class: 'pistol' } }).barrelLength?.si).toBe(
      barrelLengthByClass.pistol,
    )
    // a gun without a barrel length falls through
    expect(suggest({ cartridge, firearm: { name: 'Bare' } }).barrelLength?.si).toBe(
      barrelLengthByClass.rifle,
    )
    // no cartridge, no class: only the gun or Settings give one
    expect(suggest({}).barrelLength).toBeUndefined()
    expect(suggest({ settingsBarrelLength: 0.4 }).barrelLength?.si).toBe(0.4)
  })

  it('ignores values that are not above 0', () => {
    const none: DefaultSources = {
      firearm: { name: 'x', twist: 0, barrelLength: 0 },
      cartridge: { name: 'x', boreDiameter: 0, twist: 0 },
      bullet: { name: 'x', diameter: 0 },
      settingsBarrelLength: 0,
    }
    expect(suggest(none)).toEqual({})
  })
})

describe('the cartridge class', () => {
  it('is pistol for CIP table IV and rifle for the other tables, none without a record', () => {
    expect(cartridgeClass('IV')).toBe('pistol')
    for (const table of ['I', 'II', 'III', 'V']) expect(cartridgeClass(table)).toBe('rifle')
    expect(cartridgeClass(undefined)).toBeUndefined()
  })
})

describe('the chamber volume note', () => {
  const measuredCapacity = 3.6e-6
  const measuredSuggestion = { si: measuredCapacity, source: 'your measured case capacity' }

  it('takes the measured capacity in place of the record and drops the note', () => {
    const fromRecord = suggest({ cartridge })
    const fromMeasured = suggest({
      cartridge: { ...cartridge, capacity: measuredSuggestion },
    })
    expect(fromMeasured.volume?.si).not.toBe(fromRecord.volume?.si)
    const run = (volume: number, measured: number | undefined) => ({
      volumeMeasured: volumeMeasured({
        measuredCapacity: measured,
        volume,
        derived: [volume],
      }),
    })
    expect(volumeNoteText(run(fromMeasured.volume?.si ?? 0, measuredCapacity))).toBeUndefined()
    expect(volumeNoteText(run(fromRecord.volume?.si ?? 0, undefined))).toMatch(
      /^Chamber volume not measured: .*measured case capacity/,
    )
  })

  it('counts a record, a chosen capacity record and a typed volume as estimates', () => {
    // a record's capacity: no measured one entered
    expect(volumeMeasured({ measuredCapacity: undefined, volume: 3.9e-6, derived: [3.9e-6] })).toBe(
      false,
    )
    // typed over a measured capacity
    expect(
      volumeMeasured({ measuredCapacity, volume: 3.7e-6, derived: [measuredCapacity, 3.5e-6] }),
    ).toBe(false)
    // no volume yet
    expect(
      volumeMeasured({ measuredCapacity, volume: undefined, derived: [measuredCapacity] }),
    ).toBe(false)
  })

  it("counts the seated bullet's volume of a measured capacity as measured", () => {
    expect(
      volumeMeasured({ measuredCapacity, volume: 3.2e-6, derived: [measuredCapacity, 3.2e-6] }),
    ).toBe(true)
  })

  it('says nothing without a result', () => {
    expect(volumeNoteText(undefined)).toBeUndefined()
  })
})
