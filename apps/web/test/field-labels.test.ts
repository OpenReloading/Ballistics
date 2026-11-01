import { expect, it } from 'vitest'
import { english } from '../src/i18n/translate.ts'
import { fieldLabel } from '../src/lib/field-labels.ts'

it('names a source field by the record kind label or by its words', () => {
  expect(fieldLabel('grainForm', 'powders', english.t)).toBe('Form')
  expect(fieldLabel('waterCapacity', 'cases', english.t)).toBe('Water capacity')
  // a nested path the powder page names in its own words
  expect(fieldLabel('thermochemistry.gamma', 'powders', english.t)).toBe('Ratio of specific heats')
})

it('reads an inherited property name as its words, not as an Object member', () => {
  expect(fieldLabel('constructor', 'powders', english.t)).toBe('Constructor')
  expect(fieldLabel('toString', 'powders', english.t)).toBe('To string')
  expect(fieldLabel('grainForm', 'constructor', english.t)).toBe('Grain form')
})
