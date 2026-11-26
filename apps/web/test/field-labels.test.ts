import { expect, it } from 'vitest'
import { linguiOf } from '../src/i18n/lingui.ts'
import { english } from '../src/i18n/translate.ts'
import { fieldLabel } from '../src/lib/field-labels.ts'

const en = linguiOf('en')

it('names a source field by the record kind label or by its words', () => {
  expect(fieldLabel('grainForm', 'powders', english.t, en)).toBe('Form')
  expect(fieldLabel('waterCapacity', 'cases', english.t, en)).toBe('Water capacity')
  // a nested path the powder page names in its own words
  expect(fieldLabel('thermochemistry.gamma', 'powders', english.t, en)).toBe(
    'Ratio of specific heats',
  )
})

it('reads an inherited property name as its words, not as an Object member', () => {
  expect(fieldLabel('constructor', 'powders', english.t, en)).toBe('Constructor')
  expect(fieldLabel('toString', 'powders', english.t, en)).toBe('To string')
  expect(fieldLabel('grainForm', 'constructor', english.t, en)).toBe('Grain form')
})
