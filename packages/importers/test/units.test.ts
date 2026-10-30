import { describe, expect, it } from 'vitest'
import { parseVelocity, parseVelocityUnit, resolveUnit } from '../src/units.ts'

describe('parseVelocityUnit', () => {
  it('reads every spelling in any case and with surrounding space', () => {
    expect(parseVelocityUnit(' FPS ')).toBe('ft/s')
    expect(parseVelocityUnit('ft/s')).toBe('ft/s')
    expect(parseVelocityUnit('Mps')).toBe('m/s')
    expect(parseVelocityUnit('m/s')).toBe('m/s')
    expect(parseVelocityUnit('KPH')).toBe('km/h')
    expect(parseVelocityUnit('km/h')).toBe('km/h')
    expect(parseVelocityUnit('mph')).toBe('mph')
  })

  it('gives no unit for an unknown or missing text', () => {
    expect(parseVelocityUnit('knots')).toBeUndefined()
    expect(parseVelocityUnit('')).toBeUndefined()
    expect(parseVelocityUnit(undefined)).toBeUndefined()
  })
})

describe('resolveUnit', () => {
  it('takes the file unit, a caller unit equal to it without a warning', () => {
    const warnings: string[] = []
    expect(resolveUnit('fps', { velocityUnit: 'ft/s' }, warnings)).toBe('ft/s')
    expect(resolveUnit('M/S', { velocityUnit: 'm/s' }, warnings)).toBe('m/s')
    expect(resolveUnit('mph', {}, warnings)).toBe('mph')
    expect(warnings).toEqual([])
  })

  it('throws when the caller names another unit than the file', () => {
    expect(() => resolveUnit(' fps ', { velocityUnit: 'm/s' }, [])).toThrow(
      'velocity unit "fps" (ft/s) in the file differs from m/s named by the caller',
    )
  })

  it('throws for an unknown or missing file unit the caller does not name', () => {
    expect(() => resolveUnit(' knots ', {}, [])).toThrow(
      'velocity unit "knots" is unknown; name the unit to import this file',
    )
    expect(() => resolveUnit('  ', {}, [])).toThrow('velocity unit missing is unknown')
    expect(() => resolveUnit(undefined, {}, [])).toThrow('velocity unit missing is unknown')
  })

  it('takes the caller unit for an unknown file unit and warns once', () => {
    const warnings: string[] = []
    expect(resolveUnit('knots', { velocityUnit: 'km/h' }, warnings)).toBe('km/h')
    expect(resolveUnit('knots', { velocityUnit: 'km/h' }, warnings)).toBe('km/h')
    expect(resolveUnit(undefined, { velocityUnit: 'km/h' }, warnings)).toBe('km/h')
    expect(warnings).toEqual([
      'velocity unit "knots" in the file; using km/h as named by the caller',
      'velocity unit missing in the file; using km/h as named by the caller',
    ])
  })
})

describe('parseVelocity', () => {
  it('converts to m/s by the exact factor of each unit, rounded to 1e-6', () => {
    expect(parseVelocity('3000', 'fps', 'ft/s').value).toBe(914.4)
    expect(parseVelocity('100', 'mph', 'mph').value).toBe(44.704)
    expect(parseVelocity('36', 'km/h', 'km/h').value).toBe(10)
    expect(parseVelocity('1', 'km/h', 'km/h').value).toBe(0.277778)
  })

  it('keeps a value in m/s as written', () => {
    expect(parseVelocity('800.1234567', 'm/s', 'm/s').value).toBe(800.1234567)
  })

  it('keeps the trimmed cell and unit as raw', () => {
    expect(parseVelocity(' 2800 ', ' fps ', 'ft/s').raw).toBe('2800 fps')
    expect(parseVelocity(' 800 ', undefined, 'm/s')).toEqual({ value: 800, raw: '800' })
    expect(parseVelocity('800', ' ', 'm/s').raw).toBe('800')
  })

  it('rejects a cell that is no number or not positive', () => {
    expect(() => parseVelocity(' fast ', 'fps', 'ft/s')).toThrow('velocity "fast" is not a number')
    expect(() => parseVelocity(' 0 ', 'fps', 'ft/s')).toThrow('velocity "0" is not positive')
    expect(() => parseVelocity('-5', 'fps', 'ft/s')).toThrow('velocity "-5" is not positive')
    expect(parseVelocity('0.001', 'm/s', 'm/s').value).toBe(0.001)
  })
})
