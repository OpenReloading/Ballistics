import { describe, expect, it } from 'vitest'
import { printedConstruction } from '../src/printed-construction.ts'

// Synthetic bullet texts, written for this test: construction words around neutral type names.

describe('printedConstruction', () => {
  it('reads plated from the plating words', () => {
    expect(printedConstruction('124 gr Plated RN')).toBe('plated')
    expect(printedConstruction('Copper-Plated FP 158')).toBe('plated')
    expect(printedConstruction('Electroplated HP')).toBe('plated')
    expect(printedConstruction('Copper washed LRN')).toBe('plated')
    expect(printedConstruction('Rundkopf verkupfert 8,0 g')).toBe('plated')
  })

  it('reads monolithic from the solid-metal words', () => {
    expect(printedConstruction('Solid Copper HP 110 gr')).toBe('monolithic')
    expect(printedConstruction('solid-brass FN')).toBe('monolithic')
    expect(printedConstruction('Brass solid FN')).toBe('monolithic')
    expect(printedConstruction('MONOLITHIC BT 150')).toBe('monolithic')
    expect(printedConstruction('Mono-metal spitzer')).toBe('monolithic')
    expect(printedConstruction('Homogeneous HP')).toBe('monolithic')
    expect(printedConstruction('All copper spitzer')).toBe('monolithic')
    expect(printedConstruction('lathe-turned FB')).toBe('monolithic')
    expect(printedConstruction('Vollkupfergeschoss 9,7 g')).toBe('monolithic')
    expect(printedConstruction('Monometallic HP')).toBe('monolithic')
    expect(printedConstruction('Homogengeschoss 10 g')).toBe('monolithic')
  })

  it('names nothing for a jacketed or plain text, a plated steel jacket or both classes', () => {
    expect(printedConstruction('FMJ RN 124')).toBeUndefined()
    expect(printedConstruction('Copper jacketed HP')).toBeUndefined()
    expect(printedConstruction('Solid base SP 165')).toBeUndefined()
    expect(printedConstruction('FMJ, copper plated steel jacket')).toBeUndefined()
    expect(printedConstruction('Steel jacket, copper washed')).toBeUndefined()
    expect(printedConstruction('Stahlmantel verkupfert')).toBeUndefined()
    expect(printedConstruction('Solid copper-jacketed SP')).toBeUndefined()
    expect(printedConstruction('Plated or solid copper HP')).toBeUndefined()
  })
})
