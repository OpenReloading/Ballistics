import { expect, it } from 'vitest'
import { exportIds, isSampling, pickIds, sampleIds } from '../src/lib/prerender-sample.ts'
import { defined } from './defined.ts'

const first = (what: string) => defined(defined(sampleIds[what])[0])
const all = ['x-1', first('bullet'), 'x-2', '308-win', first('powder')]

it('returns every id unless PRERENDER is exactly sample', () => {
  expect(pickIds('bullet', all, {})).toEqual(all)
  expect(pickIds('bullet', all, { PRERENDER: 'full' })).toEqual(all)
  expect(pickIds('bullet', all, { PRERENDER: 'Sample' })).toEqual(all)
  expect(isSampling({ PRERENDER: 'sample' })).toBe(true)
})

it('keeps the sampled ids of the route that exist', () => {
  const env = { PRERENDER: 'sample' }
  expect(pickIds('cartridge', all, env)).toEqual(['308-win'])
  for (const what of ['bullet', 'powder']) expect(pickIds(what, all, env)).toEqual([first(what)])
})

it('falls back to the first id when no sampled id exists, never to none', () => {
  expect(pickIds('bullet', ['x-1', 'x-2'], { PRERENDER: 'sample' })).toEqual(['x-1'])
  expect(pickIds('unknown', ['x-1', 'x-2'], { PRERENDER: 'sample' })).toEqual(['x-1'])
})

it('cuts only the cartridge pages of the Pages edition when sampling', () => {
  const env = { PRERENDER: 'sample' }
  expect(exportIds('cartridge', all, env)).toEqual(['308-win'])
  for (const what of ['bullet', 'powder', 'target-face'])
    expect(exportIds(what, all, env)).toEqual(all)
  expect(exportIds('cartridge', all, {})).toEqual(all)
})

it('samples at least one id per route', () => {
  for (const what of ['cartridge', 'bullet', 'powder', 'target-face', 'discipline', 'federation'])
    expect(sampleIds[what]?.length).toBeGreaterThan(0)
})
