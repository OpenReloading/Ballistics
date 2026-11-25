import { expect, it } from 'vitest'
import { convert } from '../scripts/de-to-lingui.mts'
import type { PoCatalog } from '../scripts/po-catalog.mts'

const entry = (translation: string, context?: string, translatorComments: string[] = []) => ({
  translation,
  ...(context ? { context } : {}),
  extra: { translatorComments, flags: [] },
})

const en: PoCatalog = {
  'list.bullets': entry('Bullets'),
  'group.shots': entry('{count, plural, one {# shot of {name}} other {# shots of {name}}}'),
  'case.material': entry('Brass', 'material'),
  'list.new': entry('Not in de.json'),
}

const german = {
  Bullets: 'Geschosse',
  '{count} shot of {name}|{count} shots of {name}': {
    one: '{count} Schuss von {name}',
    other: '{count} Schüsse von {name}',
  },
  'material\u0004Brass': 'Messing',
  Brass: 'Hülsen',
  Unused: 'Unbenutzt',
}

it('writes the German of every id whose English de.json holds, with a note of that English', () => {
  const de: PoCatalog = {
    'list.bullets': entry(''),
    'group.shots': entry(''),
    'case.material': entry('', 'material'),
    'list.new': entry(''),
  }
  const { catalog, report, missing, unused } = convert(en, de, german)
  expect(catalog['list.bullets']).toEqual(entry('Geschosse', undefined, ['en: "Bullets"']))
  expect(catalog['group.shots']?.translation).toBe(
    '{count, plural, one {# Schuss von {name}} other {# Schüsse von {name}}}',
  )
  expect(catalog['case.material']?.translation).toBe('Messing')
  expect(catalog['list.new']?.translation).toBe('')
  expect(report.written).toEqual(['list.bullets', 'group.shots', 'case.material'])
  expect(missing).toEqual(['list.new'])
  expect(unused).toBe(2)
})

it('quotes each apostrophe of the German so a placeholder after one still fills', () => {
  const quotedEn: PoCatalog = {
    'profile.named': entry("Profile ''{name}''"),
    'profile.count': entry("{count, plural, one {# profile of ''{name}''} other {# profiles}}"),
  }
  const de: PoCatalog = { 'profile.named': entry(''), 'profile.count': entry('') }
  const { catalog } = convert(quotedEn, de, {
    "Profile '{name}'": "Profil '{name}'",
    "{count} profile of '{name}'|{count} profiles": {
      one: "{count} Profil von '{name}'",
      other: '{count} Profile',
    },
  })
  expect(catalog['profile.named']?.translation).toBe("Profil ''{name}''")
  expect(catalog['profile.count']?.translation).toBe(
    "{count, plural, one {# Profil von ''{name}''} other {# Profile}}",
  )
})

it('writes a decimal argument of the English into the German, whose de.json key has it plain', () => {
  const { catalog } = convert(
    { 'fit.exponent': entry('exponent {exponent, decimal} of {name}') },
    { 'fit.exponent': entry('') },
    { 'exponent {exponent} of {name}': 'Exponent {exponent} von {name}' },
  )
  expect(catalog['fit.exponent']?.translation).toBe('Exponent {exponent, decimal} von {name}')
})

it('takes no German from a name the entries only inherit', () => {
  const { catalog, missing } = convert(
    { 'object.constructor': entry('constructor') },
    { 'object.constructor': entry('') },
    {},
  )
  expect(catalog['object.constructor']?.translation).toBe('')
  expect(missing).toEqual(['object.constructor'])
})

it('keeps German that differs from de.json and only adds the note where it is the same', () => {
  const de: PoCatalog = {
    'list.bullets': entry('Kugeln', undefined, ['checked']),
    'case.material': entry('Messing', 'material', ['checked']),
  }
  const { catalog, report } = convert(en, de, german)
  expect(catalog['list.bullets']).toEqual(entry('Kugeln', undefined, ['checked']))
  expect(catalog['case.material']).toEqual(entry('Messing', 'material', ['checked', 'en: "Brass"']))
  expect(report.other).toEqual(['list.bullets'])
  expect(report.kept).toEqual(['case.material'])
})
