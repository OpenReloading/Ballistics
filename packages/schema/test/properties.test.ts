import * as fc from 'fast-check'
import { expect, it } from 'vitest'
import {
  applyOverrides,
  compareKeys,
  parseRef,
  recordIdRegex,
  ref,
  score,
  searchKey,
  sortKey,
  withoutUnknownKinds,
} from '../src/index.ts'

const recordId = fc.stringMatching(recordIdRegex)
const word = fc.stringMatching(/^[a-z0-9]{1,8}$/)

it('reads back the scope and id of every reference it accepts', () => {
  const reference = fc.oneof(
    recordId.map((id) => ({ scope: 'catalogue' as const, id })),
    fc.uuid().map((id) => ({ scope: 'user' as const, id })),
  )
  fc.assert(
    fc.property(reference, (r) => {
      const text = `${r.scope}:${r.id}`
      expect(ref('bullet').safeParse(text).success).toBe(true)
      expect(parseRef(text)).toEqual(r)
    }),
  )
})

it('reads no reference from a text the reference schema refuses', () => {
  fc.assert(
    fc.property(fc.string(), (text) => {
      expect(parseRef(text) === undefined).toBe(!ref('bullet').safeParse(text).success)
    }),
  )
})

it('orders sort keys totally, with digit runs in numeric order', () => {
  fc.assert(
    fc.property(fc.string(), fc.string(), (a, b) => {
      const x = sortKey(a)
      const y = sortKey(b)
      expect(Math.sign(compareKeys(x, y)) + Math.sign(compareKeys(y, x))).toBe(0)
      expect(compareKeys(x, y) === 0).toBe(x === y)
    }),
  )
  fc.assert(
    fc.property(fc.nat(99_999_999), fc.nat(99_999_999), (a, b) => {
      const order = compareKeys(sortKey(`Scheibe ${a}`), sortKey(`Scheibe ${b}`))
      expect(Math.sign(order)).toBe(Math.sign(a - b))
    }),
  )
})

// the exact name scores higher in its own word order, so the name here is another text
it('scores every order of the words of a query alike', () => {
  fc.assert(
    fc.property(fc.array(word, { minLength: 2, maxLength: 4 }), (words) => {
      const key = searchKey(['Maker', words.join(' ')])
      expect(score(key, words.toReversed().join(' '))).toBe(score(key, words.join(' ')))
    }),
  )
})

it('leaves the base untouched and keeps it whole under empty overrides', () => {
  fc.assert(
    fc.property(fc.dictionary(word, fc.jsonValue()), (base) => {
      const copy = structuredClone(base)
      expect(applyOverrides(base, {})).toEqual(base)
      applyOverrides(base, { added: 1 })
      expect(base).toEqual(copy)
    }),
  )
})

it('keeps or skips each record, so none is lost', () => {
  const kind = fc.constantFrom('bullet', 'load', 'eventOfALaterVersion', 'other')
  const records = fc.array(fc.record({ kind, id: word }))
  fc.assert(
    fc.property(records, (rs) => {
      const { json, skipped } = withoutUnknownKinds({ records: rs })
      const kept = (json as { records: unknown[] }).records.length
      expect(kept + skipped.reduce((n, s) => n + s.count, 0)).toBe(rs.length)
    }),
  )
})
