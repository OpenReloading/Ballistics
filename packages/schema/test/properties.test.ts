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

// texts at the boundary: a scope or a near scope before a valid or broken id of either scope
const nearMiss = fc.oneof(
  fc.string(),
  fc
    .tuple(
      fc.constantFrom('catalogue:', 'user:', 'catalogue', 'Catalogue:', 'user:catalogue:', ''),
      fc.oneof(
        recordId,
        fc.uuid(),
        fc.string(),
        recordId.map((id) => `${id}-`),
        fc.uuid().map((u) => u.toUpperCase()),
      ),
    )
    .map(([scope, id]) => scope + id),
)

it('reads a reference from a text exactly when the reference schema accepts it', () => {
  fc.assert(
    fc.property(nearMiss, (text) => {
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
    fc.property(fc.array(fc.string(), { minLength: 3, maxLength: 3 }), (names) => {
      const [x = '', y = '', z = ''] = names.map((n) => sortKey(n)).toSorted(compareKeys)
      expect([compareKeys(x, y), compareKeys(y, z), compareKeys(x, z)].every((c) => c <= 0)).toBe(
        true,
      )
    }),
  )
  fc.assert(
    fc.property(fc.nat(99_999_999), fc.nat(99_999_999), (a, b) => {
      const order = compareKeys(sortKey(`Scheibe ${a}`), sortKey(`Scheibe ${b}`))
      expect(Math.sign(order)).toBe(Math.sign(a - b))
    }),
  )
})

// the exact name scores higher in its own word order, so the name holds an `&`, which no word has
it('scores every order of the words of a query alike', () => {
  fc.assert(
    fc.property(fc.array(word, { minLength: 2, maxLength: 4 }), (words) => {
      const key = searchKey(['Maker & Co', words.join(' ')])
      expect(score(key, words.toReversed().join(' '))).toBe(score(key, words.join(' ')))
    }),
    { examples: [[['ma', 'ker']]] },
  )
})

// base and overrides share three keys, so overrides reach into the nested objects of the base
const leaf = fc.oneof(
  fc.integer(),
  fc.constant(null),
  fc.integer().map((value) => ({ value })),
)
const { tree } = fc.letrec<{ tree: Record<string, unknown>; node: unknown }>((tie) => ({
  tree: fc.dictionary(fc.constantFrom('a', 'b', 'c'), tie('node'), { maxKeys: 3 }),
  node: fc.oneof({ maxDepth: 3 }, leaf, tie('tree')),
}))

it('leaves the base untouched and keeps it whole under empty overrides', () => {
  fc.assert(
    fc.property(tree, tree, (base, overrides) => {
      const copy = structuredClone(base)
      expect(applyOverrides(base, {})).toEqual(base)
      applyOverrides(base, overrides)
      expect(base).toEqual(copy)
    }),
  )
})

it('drops the records of unknown kinds only, in order, and counts each such kind', () => {
  const unknownKinds: unknown[] = ['eventOfALaterVersion', 'other']
  const kind = fc.constantFrom('bullet', 'load', 'workbenchState', 7, ...unknownKinds)
  const records = fc.array(fc.record({ kind, id: word }))
  fc.assert(
    fc.property(records, (rs) => {
      const { json, skipped } = withoutUnknownKinds({ records: rs })
      const counts: Record<string, number> = {}
      for (const { kind: k } of rs)
        if (unknownKinds.includes(k)) counts[String(k)] = (counts[String(k)] ?? 0) + 1
      expect((json as { records: unknown[] }).records).toEqual(
        rs.filter((r) => !unknownKinds.includes(r.kind)),
      )
      expect(Object.fromEntries(skipped.map((s) => [s.kind, s.count]))).toEqual(counts)
    }),
  )
})
