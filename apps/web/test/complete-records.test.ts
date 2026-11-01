import { expect, it } from 'vitest'
import {
  bulletIncomplete,
  completeFirst,
  powderIncomplete,
  powderRowIncomplete,
} from '../src/lib/complete-records.ts'

const rows = [
  { id: 'a', nameOnly: true as const },
  { id: 'b' },
  { id: 'c', nameOnly: true as const },
  { id: 'd' },
]

it('hides the incomplete records with the filter on, else lists them after the complete ones', () => {
  expect(completeFirst(rows, bulletIncomplete, true).map((r) => r.id)).toEqual(['b', 'd'])
  expect(completeFirst(rows, bulletIncomplete, false).map((r) => r.id)).toEqual([
    'b',
    'd',
    'a',
    'c',
  ])
})

it('counts a name-only bullet and a powder without burn values as incomplete', () => {
  expect(bulletIncomplete({ nameOnly: true })).toBe(true)
  expect(bulletIncomplete({})).toBe(false)
  expect(powderIncomplete({ interior: { vivacity: 0.6 } })).toBe(false)
  expect(powderIncomplete({})).toBe(true)
  expect(powderRowIncomplete({ meanVivacity: 0.6 })).toBe(false)
  expect(powderRowIncomplete({})).toBe(true)
  // a powder design of the browser has its own model
  expect(powderRowIncomplete({ origin: 'user' })).toBe(false)
})
