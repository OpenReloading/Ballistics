import { describe, expect, it } from 'vitest'
import {
  barrelLengthByClass,
  cartridgeClass,
  type DefaultSources,
  suggestDefaults,
} from '../src/lib/input-defaults.ts'

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
    expect(suggestDefaults({})).toEqual({})
  })

  it('takes the case volume from the cartridge record only', () => {
    expect(suggestDefaults({ cartridge }).volume).toEqual(capacity)
    expect(
      suggestDefaults({ cartridge, firearm: gun, bullet, settingsBarrelLength: 0.4 }).volume,
    ).toEqual(capacity)
    expect(
      suggestDefaults({ cartridge: { ...cartridge, capacity: undefined } }).volume,
    ).toBeUndefined()
    expect(suggestDefaults({ firearm: gun, bullet }).volume).toBeUndefined()
  })

  it('takes the bore area from the record chamber area Q, none without it', () => {
    expect(suggestDefaults({ cartridge: { ...cartridge, boreArea: 47.51e-6 } }).boreArea).toEqual({
      si: 47.51e-6,
      source: 'CIP bore area Q of 308 Win.',
    })
    expect(suggestDefaults({ cartridge, bullet }).boreArea).toBeUndefined()
  })

  it('takes the bore diameter from the record land diameter F, else from the bullet diameter', () => {
    expect(suggestDefaults({ cartridge, bullet }).boreDiameter).toEqual({
      si: 0.00762,
      source: 'CIP land diameter F of 308 Win.',
    })
    expect(
      suggestDefaults({ cartridge: { ...cartridge, boreDiameter: undefined }, bullet }).boreDiameter
        ?.si,
    ).toBe(0.00782)
    expect(suggestDefaults({ bullet }).boreDiameter?.si).toBe(0.00782)
    expect(
      suggestDefaults({ cartridge: { ...cartridge, boreDiameter: undefined } }).boreDiameter,
    ).toBeUndefined()
  })

  it('takes the twist from the gun, else from the record u, never from a class', () => {
    expect(suggestDefaults({ cartridge, firearm: gun }).twist).toEqual({
      si: 0.254,
      source: 'your firearm Range rifle',
      fromFirearm: true,
    })
    expect(suggestDefaults({ cartridge }).twist).toEqual({
      si: 0.305,
      source: 'CIP twist u of 308 Win.',
    })
    // a gun without twist, or with the 0 of no rifling, leaves the record's
    expect(suggestDefaults({ cartridge, firearm: { name: 'Smooth' } }).twist?.si).toBe(0.305)
    expect(suggestDefaults({ cartridge, firearm: { name: 'Smooth', twist: 0 } }).twist?.si).toBe(
      0.305,
    )
    // without a record the field stays empty (no common twist by caliber yet)
    expect(suggestDefaults({ bullet }).twist).toBeUndefined()
    expect(suggestDefaults({ cartridge: { ...cartridge, twist: undefined } }).twist).toBeUndefined()
  })

  it('takes the barrel length from the gun, else Settings, else the class', () => {
    expect(
      suggestDefaults({ cartridge, firearm: gun, settingsBarrelLength: 0.4 }).barrelLength,
    ).toEqual({
      si: 0.508,
      source: 'your firearm Range rifle',
      fromFirearm: true,
    })
    expect(suggestDefaults({ cartridge, settingsBarrelLength: 0.4 }).barrelLength).toEqual({
      si: 0.4,
      source: 'your default from Settings',
    })
    expect(suggestDefaults({ cartridge }).barrelLength).toEqual({
      si: barrelLengthByClass.rifle,
      source: 'rifle barrel, assumption, no source',
    })
    expect(suggestDefaults({ cartridge: { ...cartridge, class: 'pistol' } }).barrelLength?.si).toBe(
      barrelLengthByClass.pistol,
    )
    // a gun without a barrel length falls through
    expect(suggestDefaults({ cartridge, firearm: { name: 'Bare' } }).barrelLength?.si).toBe(
      barrelLengthByClass.rifle,
    )
    // no cartridge, no class: only the gun or Settings give one
    expect(suggestDefaults({}).barrelLength).toBeUndefined()
    expect(suggestDefaults({ settingsBarrelLength: 0.4 }).barrelLength?.si).toBe(0.4)
  })

  it('ignores values that are not above 0', () => {
    const none: DefaultSources = {
      firearm: { name: 'x', twist: 0, barrelLength: 0 },
      cartridge: { name: 'x', boreDiameter: 0, twist: 0 },
      bullet: { name: 'x', diameter: 0 },
      settingsBarrelLength: 0,
    }
    expect(suggestDefaults(none)).toEqual({})
  })
})

describe('the cartridge class', () => {
  it('is pistol for CIP table IV and rifle for the other tables, none without a record', () => {
    expect(cartridgeClass('IV')).toBe('pistol')
    for (const table of ['I', 'II', 'III', 'V']) expect(cartridgeClass(table)).toBe('rifle')
    expect(cartridgeClass(undefined)).toBeUndefined()
  })
})
