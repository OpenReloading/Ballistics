import { expect, it } from 'vitest'
import { recordPaths } from '../scripts/prerender-list.mts'

const rows = (...ids: string[]) => ids.map((id) => ({ item: { id } }))
const index = {
  bullets: rows('demo-bullet-168'),
  cartridges: rows('308-win', 'not-in-the-sample'),
  cases: rows('demo-case-308-brass'),
  disciplines: rows('bds-2102'),
  federations: rows('dsb'),
  powders: rows('demo-powder-dp40'),
  primers: rows('demo-primer-large-rifle'),
  targetFaces: rows('bdmp-nr6'),
}

it('lists every record at its page path, the target faces under targets', () => {
  expect(recordPaths(index, {})).toEqual([
    '/bullets/demo-bullet-168/',
    '/cartridges/308-win/',
    '/cartridges/not-in-the-sample/',
    '/cases/demo-case-308-brass/',
    '/disciplines/bds-2102/',
    '/federations/dsb/',
    '/powders/demo-powder-dp40/',
    '/primers/demo-primer-large-rifle/',
    '/targets/bdmp-nr6/',
  ])
})

it("leaves out what today's export leaves out of a sample build", () => {
  const paths = recordPaths(index, { PRERENDER: 'sample' })
  expect(paths).toContain('/cartridges/308-win/')
  expect(paths).not.toContain('/cartridges/not-in-the-sample/')
})
