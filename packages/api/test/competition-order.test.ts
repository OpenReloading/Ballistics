import {
  compareDisciplines,
  compareFederations,
  compareTargetFaces,
  type DisciplineKey,
} from '@openreloading/schema'
import { describe, expect, it } from 'vitest'
import { loadBundle } from '../src/bundle.ts'
import { API_PREFIX } from '../src/version.ts'
import { withApi } from './setup.ts'

const real = loadBundle()
const api = withApi({ seed: real })
const key = (d: (typeof real.disciplines)[number]): DisciplineKey => ({
  ...d,
  distanceMm: d.distance.value,
})
const ids = (body: { items: { id: string }[] }) => body.items.map((i) => i.id)

describe('default order of the competition lists, on the real records', () => {
  it('lists federations by abbreviation', async () => {
    const { body } = await api.get(`${API_PREFIX}/federations`)
    expect(ids(body)).toEqual(ids({ items: real.federations.toSorted(compareFederations) }))
  })

  it('lists disciplines by federation, then its own code', async () => {
    const { body } = await api.get(`${API_PREFIX}/disciplines`)
    const expected = real.disciplines.toSorted((a, b) => compareDisciplines(key(a), key(b)))
    expect(ids(body)).toEqual(ids({ items: expected }))
    const numbered = (federation: string) =>
      body.items.filter((d: { federation: string }) => d.federation === federation)
    const place = (federation: string, number: string) =>
      numbered(federation).findIndex((d: { number?: string }) => d.number === number)
    // not derived from the comparators: the first and last BDS numbers of the records
    const bdsNumbers = numbered('bds').map((d: { number?: string }) => d.number)
    expect(bdsNumbers.slice(0, 4)).toEqual(['10xx', '11xx', '20xx', '2101'])
    expect(bdsNumbers.slice(-2)).toEqual(['73xx', '75xx'])
    expect(place('bds', '2101')).toBeLessThan(place('bds', '4110'))
    expect(place('bds', '4110')).toBeLessThan(place('bds', '73xx'))
    expect(place('dsb', '1.10')).toBeLessThan(place('dsb', '2.20'))
    const filtered = (await api.get(`${API_PREFIX}/disciplines?federation=bds`)).body
    expect(ids(filtered)).toEqual(ids({ items: numbered('bds') }))
  })

  it('lists target faces by organization, then the printed code, then name', async () => {
    const { body } = await api.get(`${API_PREFIX}/target-faces`)
    expect(ids(body)).toEqual(ids({ items: real.targetFaces.toSorted(compareTargetFaces) }))
    const bds = body.items
      .filter((f: { organization: string }) => f.organization === 'BDS')
      .map((f: { name: string }) => f.name)
    expect(bds.indexOf('BDS-50m-ZF-Scheibe (Z2)')).toBeLessThan(bds.indexOf('BDS-PG-Scheibe (Z18)'))
  })

  it('lists target mappings in the order of their disciplines', async () => {
    const { body } = await api.get(`${API_PREFIX}/target-mappings`)
    const order = ids((await api.get(`${API_PREFIX}/disciplines`)).body)
    const places = body.items.map((m: { discipline: string }) => order.indexOf(m.discipline))
    expect(places).toEqual(places.toSorted((a: number, b: number) => a - b))
    expect(body.total).toBe(real.targetMappings.length)
  })
})
