import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { caseType } from '../src/catalogue/derive.ts'

describe('caseType', () => {
  it('sorts the head by R1 over P1 at the bounds, a belt first', () => {
    expect(caseType(12.01, 11.96, null)).toBe('rimless')
    expect(caseType(11.96, 12.21, null)).toBe('rimless')
    expect(caseType(11.95, 12.21, null)).toBe('rebated')
    expect(caseType(12.26, 11.96, null)).toBe('rimless')
    expect(caseType(12.27, 11.96, null)).toBe('semi-rimmed')
    // 220 Swift
    expect(caseType(12.01, 11.36, null)).toBe('semi-rimmed')
    expect(caseType(12.66, 11.96, null)).toBe('semi-rimmed')
    // 351 Win. SL, the rimmed revolver heads from 0.75 mm
    expect(caseType(10.41, 9.66, null)).toBe('rimmed')
    expect(caseType(13.5, 12.2, 13.4)).toBe('belted')
    expect(caseType(null, 12.2, null)).toBeUndefined()
  })

  it('keeps table III belted and table II rimmed, but for its three semi-rimmed heads', () => {
    const dir = path.join(import.meta.dirname, '../../data/records/cartridges')
    const types = new Map<string, Set<string>>()
    const named: Record<string, string> = {
      '308-win': 'rimless',
      '300-win-short-mag': 'rebated',
      '303-british': 'rimmed',
      '300-win-mag': 'belted',
    }
    const checkSheet = (f: string) => {
      const s = JSON.parse(readFileSync(path.join(dir, f), 'utf8'))
      const v = (symbol: string) =>
        s.values.find(
          (x: { side?: string; symbol: string }) => x.side === 'cartridge' && x.symbol === symbol,
        )?.value ?? null
      const type = caseType(v('R1'), v('P1'), v('R3'))
      if (s.id in named) expect(type).toBe(named[s.id])
      if (type === undefined) return
      types.set(s.table, (types.get(s.table) ?? new Set()).add(type))
      if (s.table === 'II' && type !== 'rimmed') expect(s.id).toMatch(/win-sl|arisaka/)
      if (s.id === '220-swift') expect(type).toBe('semi-rimmed')
    }
    for (const f of readdirSync(dir)) checkSheet(f)
    expect([...(types.get('III') ?? [])]).toEqual(['belted'])
    expect([...(types.get('II') ?? [])].sort()).toEqual(['rimmed', 'semi-rimmed'])
  })
})
