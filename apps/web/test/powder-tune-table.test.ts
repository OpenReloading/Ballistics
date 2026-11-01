import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { fetchRecord } from '../src/lib/api-fetch.ts'
import { exampleInterior } from '../src/lib/example-data.ts'
import { interiorBody } from '../src/lib/interior-input.ts'
import { revolverLeakNote, writeTuneLoad } from '../src/lib/powder-tune.ts'
import { tuneTable } from '../src/lib/tune-load.ts'

vi.mock('../src/lib/api-fetch.ts', () => ({ fetchRecord: vi.fn() }))
const fetched = vi.mocked(fetchRecord)

beforeEach(() => {
  const store = new Map<string, string>()
  vi.stubGlobal('sessionStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => store.set(k, v),
    removeItem: (k: string) => store.delete(k),
  })
})
afterEach(() => {
  vi.unstubAllGlobals()
  fetched.mockReset()
})

const ref = 'user:0b5f7a2e-3c1d-4e8f-9a6b-2d4c8e1f7a30'
const { load } = interiorBody(exampleInterior)

it('fetches the table of a cartridge record handed over while loading, for the revolver note', async () => {
  expect(load.leakage).toBeUndefined()
  let arrive: (r: { table: string }) => void = () => {}
  fetched.mockReturnValue(new Promise((resolve) => (arrive = resolve)))
  writeTuneLoad(ref, load, undefined, undefined, '357-mag')
  const table = tuneTable(ref)
  arrive({ table: 'IV' })
  expect(fetched).toHaveBeenCalledWith('cartridges', '357-mag', undefined)
  expect(revolverLeakNote(await table, load)).toBe(true)
})

it('takes a handed-over table first and fetches nothing without a cartridge', async () => {
  writeTuneLoad(ref, load, undefined, 'I', '308-win')
  expect(await tuneTable(ref)).toBe('I')
  writeTuneLoad(ref, load)
  expect(await tuneTable(ref)).toBeUndefined()
  expect(fetched).not.toHaveBeenCalled()
})

it('gives no table when the record cannot be fetched', async () => {
  fetched.mockRejectedValue(new Error('Error 500.'))
  writeTuneLoad(ref, load, undefined, undefined, '357-mag')
  expect(await tuneTable(ref)).toBeUndefined()
})
