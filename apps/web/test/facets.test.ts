import { expect, it } from 'vitest'
import { type Facet, facetNames, facetOptions, facetRows } from '../src/lib/facets.ts'

type Row = { id: string; org: string; distances: string[]; rings: string }
const rows: Row[] = [
  { id: 'a', org: 'DSB', distances: ['25', '50'], rings: '10' },
  { id: 'b', org: 'DSB', distances: ['25'], rings: '10' },
  { id: 'c', org: 'ISSF', distances: ['50'], rings: '10' },
  { id: 'd', org: 'ISSF', distances: [], rings: '10' },
]
const facets: Facet<Row>[] = [
  { key: 'org', label: 'Federation', values: (r) => [r.org] },
  { key: 'dist', label: 'Distance', values: (r) => r.distances, text: (v) => `${v} m` },
  { key: 'rings', label: 'Rings', values: (r) => [r.rings] },
]
const ids = (selected: Record<string, string[]>) =>
  facetRows(rows, facets, selected).map((r) => r.id)

it('passes a row with one of the values chosen per filter and every filter', () => {
  expect(ids({})).toEqual(['a', 'b', 'c', 'd'])
  expect(ids({ org: [] })).toEqual(['a', 'b', 'c', 'd'])
  expect(ids({ org: ['DSB', 'ISSF'] })).toEqual(['a', 'b', 'c', 'd'])
  expect(ids({ dist: ['50'] })).toEqual(['a', 'c'])
  expect(ids({ org: ['ISSF'], dist: ['50', '25'] })).toEqual(['c'])
  // a row without a value never passes a filter that is set
  expect(ids({ dist: ['25', '50'] })).not.toContain('d')
})

it('counts each option over the rows the other filters leave, and not its own filter', () => {
  const count = (selected: Record<string, string[]>, key: string, base = rows) =>
    Object.fromEntries(
      (facetOptions(rows, base, facets, selected).get(key) ?? []).map((o) => [o.value, o.count]),
    )
  expect(count({}, 'org')).toEqual({ DSB: 2, ISSF: 2 })
  // choosing DSB leaves DSB's own count alone and narrows the distances
  expect(count({ org: ['DSB'] }, 'org')).toEqual({ DSB: 2, ISSF: 2 })
  expect(count({ org: ['DSB'] }, 'dist')).toEqual({ 25: 2, 50: 1 })
  expect(count({ org: ['DSB'], dist: ['50'] }, 'org')).toEqual({ DSB: 1, ISSF: 1 })
  // an option that leaves nothing counts 0 and stays listed
  expect(count({ org: ['ISSF'] }, 'dist')).toEqual({ 25: 0, 50: 1 })
  // the search narrows the counts (the base), not the options
  expect(count({}, 'org', rows.slice(0, 3))).toEqual({ DSB: 2, ISSF: 1 })
})

it('leaves out a filter with fewer than two values unless a value is chosen, and orders and names the options', () => {
  expect(facetOptions(rows, rows, facets, {}).has('rings')).toBe(false)
  const kept = facetOptions(rows, rows, facets, { rings: ['10'] }).get('rings')
  expect(kept?.map((o) => o.value)).toEqual(['10'])
  // a chosen value no row has stays, to be unchecked; its own filter does not narrow its counts
  const stale = facetOptions(rows, rows, facets, { org: ['BDS'] }).get('org')
  expect(stale).toEqual([
    { value: 'BDS', text: 'BDS', count: 0 },
    { value: 'DSB', text: 'DSB', count: 2 },
    { value: 'ISSF', text: 'ISSF', count: 2 },
  ])
  expect(facetOptions(rows, rows, facets, {}).get('dist')).toEqual([
    { value: '25', text: '25 m', count: 2 },
    { value: '50', text: '50 m', count: 2 },
  ])
  expect(facetNames(facets, { org: ['DSB'], dist: ['25', '50'], rings: [] })).toEqual([
    'Federation DSB',
    'Distance 25 m, 50 m',
  ])
})
