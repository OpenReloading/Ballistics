import { expect, it } from 'vitest'
import { recordPaths } from '../scripts/prerender-list.mts'
import { checkRecordPaths } from '../src/routes/-static-paths.ts'

const row = (id: string) => [{ item: { id } }]

it('takes the path of every record kind the prerender list writes', () => {
  const index = {
    bullets: row('a'),
    cartridges: row('b'),
    cases: row('c'),
    disciplines: row('d'),
    federations: row('e'),
    powders: row('f'),
    primers: row('g'),
    targetFaces: row('h'),
  }
  expect(checkRecordPaths(recordPaths(index, {}))).toHaveLength(8)
})

it('fails a record path that no record route takes', () => {
  expect(() =>
    checkRecordPaths(['/bullets/a/', '/bullet/a/', '/target-faces/h/', '/bullets/compare/x/']),
  ).toThrow('No record route for /bullet/a/, /target-faces/h/, /bullets/compare/x/')
})

it('fails a record path that is also a static path', () => {
  expect(() => checkRecordPaths(['/bullets/a/', '/bullets/compare/'])).toThrow(
    'Record paths collide with static routes: /bullets/compare/',
  )
})
