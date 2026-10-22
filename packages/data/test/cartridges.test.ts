import { describe, expect, it } from 'vitest'
import { readRecords } from '../src/records.ts'

const { cartridges } = readRecords().bundle
const byId = (id: string) => cartridges.find((c) => c.id === id)
const value = (id: string, side: 'cartridge' | 'chamber' | undefined, symbol: string) =>
  byId(id)?.values.find((v) => v.side === side && v.symbol === symbol)

describe('the committed C.I.P. cartridge records', () => {
  it('include cartridges added from the official listing', () => {
    expect(byId('338-advanced-rifle-cartridge')?.name).toBe('338 Advanced Rifle Cartridge')
  })

  it('keep one record for a cartridge C.I.P. renamed, the new name as its alias', () => {
    for (const name of ['243 Win. SS Mag.', '243 Win. Super Short Mag.'])
      expect(
        cartridges.filter((c) => c.name === name || c.aliases?.includes(name)).map((c) => c.id),
      ).toEqual(['243-win-super-short-mag'])
    expect(byId('243-win-super-short-mag')?.table).toBe('I')
  })

  it('hold no cartridge without a C.I.P. sheet', () => {
    expect(byId('22-creedmoor')).toBeUndefined()
  })

  it('give the 308 Win. sheet values, its verification and the C.I.P. as publisher', () => {
    const win = byId('308-win')
    expect(win).toMatchObject({ table: 'I', verification: 'verified' })
    expect(win?.provenance.sources[0]).toMatchObject({
      publisher: expect.stringContaining('(C.I.P.)'),
    })
    expect(value('308-win', 'cartridge', 'L3')).toMatchObject({ quantity: 'length', value: 51.18 })
    expect(value('308-win', 'cartridge', 'L6')).toMatchObject({ quantity: 'length', value: 71.12 })
    expect(value('308-win', 'cartridge', 'G1')).toMatchObject({ quantity: 'length', value: 7.85 })
    expect(value('308-win', undefined, 'Pmax')).toMatchObject({
      quantity: 'pressure',
      value: 4150,
    })
    expect(value('308-win', 'chamber', 'alpha1')).toMatchObject({ quantity: 'angle' })
  })
})
