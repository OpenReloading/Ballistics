import { expect, it } from 'vitest'
import { linguiOf } from '../src/i18n/lingui.ts'
import { listTitles } from '../src/lib/list-titles.ts'

it('has the English of the list titles without another page', () => {
  const missing: string[] = []
  const en = linguiOf('en')
  const stop = en.on('missing', ({ id }) => missing.push(id))
  const titles = Object.values(listTitles).map((title) => en._(title))
  stop()
  expect(missing).toEqual([])
  expect(titles).toEqual([
    'Bullets',
    'Cartridges',
    'Powders',
    'Brass',
    'Primers',
    'Targets',
    'Disciplines',
    'Federations',
    'Firearms',
    'Brass group',
  ])
})
