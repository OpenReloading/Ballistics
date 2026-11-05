import { describe, expect, it } from 'vitest'
import {
  formatNumber,
  formatQuantity,
  inchText,
  lengthText,
  msText,
  percentText,
  presetUnits,
  shownLength,
  unitsOf,
  withUnit,
} from '../src/index.ts'

const metric = presetUnits('metric-grams')
const grains = presetUnits('metric-grains')
const us = presetUnits('us')
const inch = 0.0254

describe('formatQuantity', () => {
  it('prints fixed decimals without a negative zero or grouping', () => {
    expect(formatQuantity('lineOfSightOffset', grains, -1e-7, 'en')).toBe('0.0')
    expect(formatQuantity('length', us, 51.18e-3, 'en')).toBe('2.0150')
    expect(formatNumber(4150, 0, 'en')).toBe('4150')
    expect(formatQuantity('pressure', us, 4150e5, 'en')).toBe('60191')
  })

  it('drops the zero before the point of inch values below 1 only', () => {
    expect(formatQuantity('length', us, 0.308 * inch, 'en')).toBe('.3080')
    expect(formatQuantity('length', us, 1.2 * inch, 'en')).toBe('1.2000')
    expect(formatQuantity('lineOfSightOffset', us, -0.31 * inch, 'en')).toBe('-.3')
    expect(formatQuantity('lineOfSightOffset', us, -1e-7, 'en')).toBe('0')
    expect(formatQuantity('lineOfSightOffset', us, 0, 'en')).toBe('0')
    expect(formatQuantity('length', metric, 0.5e-3, 'en')).toBe('0.50')
    expect(formatQuantity('correction', us, 0.5 * unitsOf.correction.MOA.toSi(1), 'en')).toBe(
      '0.50',
    )
    expect(
      formatQuantity(
        'ballisticCoefficient',
        us,
        unitsOf.ballisticCoefficient['lb/in2'].toSi(0.264),
        'en',
      ),
    ).toBe('0.264')
    expect(formatQuantity('area', us, 0.5 * inch ** 2, 'en')).toBe('0.50000')
    expect(formatQuantity('barrelLength', grains, 0.6096, 'en')).toBe('24.00')
    expect(formatQuantity('barrelLength', metric, 0.6096, 'en')).toBe('610')
  })

  it('prints times, fractions and values with their unit', () => {
    expect(msText(0.0012345, 'en')).toBe('1.235 ms')
    expect(msText(0.0012345, 'de')).toBe('1,235 ms')
    expect(percentText(0.125, 'en')).toBe('12.5 %')
    expect(withUnit('velocity', us, 822.96, 'en')).toBe('2700 ft/s')
    expect(withUnit('length', metric, 0.5e-3, 'de')).toBe('0,50 mm')
  })
})

describe('inch values', () => {
  it('drop the zero before the English point', () => {
    expect(inchText('0.308', 'in', 'en')).toBe('.308')
    expect(inchText('-0.25', 'in', 'en')).toBe('-.25')
    expect(inchText('0.00', 'in', 'en')).toBe('0')
    expect(inchText('10.25', 'in', 'en')).toBe('10.25')
    expect(inchText('10.00', 'in', 'en')).toBe('10.00')
  })

  it('keep the zero before the German comma, which German writes', () => {
    expect(inchText('0,308', 'in', 'de')).toBe('0,308')
    expect(inchText('0,00', 'in', 'de')).toBe('0')
    expect(inchText('-0,25', 'in', 'de')).toBe('-0,25')
    expect(inchText('0.25', 'in', 'de')).toBe('0.25')
  })

  it('leave other units as they are', () => {
    expect(inchText('0.308', 'mm', 'en')).toBe('0.308')
    expect(inchText('0.0', 'mm', 'en')).toBe('0.0')
  })
})

describe('lengths', () => {
  it('gives travels to 0.1 mm or 0.01 in and diameters to 0.01 mm or 0.001 in', () => {
    expect(shownLength('travel', us, 22.5028 * inch, 'en')).toBe('22.50 in')
    expect(shownLength('travel', grains, 0.334621, 'en')).toBe('334.6 mm')
    expect(shownLength('diameter', us, 0.308 * inch, 'en')).toBe('.308 in')
    expect(shownLength('diameter', grains, 7.823e-3, 'de')).toBe('7,82 mm')
  })

  it("takes the unit's decimals for a length unit without workbench decimals", () => {
    const cm = { ...metric, length: unitsOf.lineOfSightOffset.cm }
    expect(lengthText('travel', cm, 0.1234, 'en')).toBe('12.3')
  })
})
