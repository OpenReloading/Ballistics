import { expect, it } from 'vitest'
import { outdated } from '../scripts/lingui-outdated.mts'
import type { PoCatalog } from '../scripts/po-catalog.mts'

const entry = (translation: string, translatorComments: string[] = []) => ({
  translation,
  extra: { translatorComments, flags: [] },
})

it('lists the German entries whose English changed since they were written or that name none', () => {
  const en: PoCatalog = {
    'case.group': entry('Case group'),
    'list.bullets': entry('Bullets'),
    'list.primers': entry('Primers'),
    'list.powders': entry('Powders'),
  }
  const de: PoCatalog = {
    'case.group': entry('Hülsengruppe', ['en: "Brass group"']),
    'list.bullets': entry('Geschosse', ['en: "Bullets"']),
    'list.primers': entry('Zündhütchen'),
    'list.powders': entry(''),
  }
  expect(outdated(en, de)).toEqual([
    { id: 'case.group', noted: 'Brass group', english: 'Case group' },
    { id: 'list.primers', noted: undefined, english: 'Primers' },
  ])
})
