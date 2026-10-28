import 'fake-indexeddb/auto'
import type { Powder, UserPowderFit } from '@open-reloading/schema'
import { beforeEach, describe, expect, it } from 'vitest'
import { newerFit, type PowderDesign } from '../src/lib/powder-designer.ts'
import { deleteRecords, putRecords, storedRecords } from '../src/lib/user-store.ts'

const ids = ['a', 'b', 'c', 'd'].map((x) => `${x.repeat(8)}-6a7d-4e0f-9b1a-2c3d4e5f6a7b`)
const [a, b, c, d] = ids as [string, string, string, string]

/** A powder record as the store holds it; only the fit's date and `previous` matter here. */
const powder = (id: string, day: number, previous?: string) => ({
  kind: 'powder' as const,
  id,
  name: id,
  saved: '2026-10-28T00:00:00.000Z',
  data: {
    origin: 'user' as const,
    fit: { date: `2026-10-${10 + day}T00:00:00.000Z`, ...(previous && { previous }) },
  },
})

/** The stored powders as designs of the rule, each read as built. */
async function designs(): Promise<PowderDesign[]> {
  const { records, invalid } = await storedRecords()
  return [...records, ...invalid.map((i) => i.raw as (typeof records)[number])].flatMap((r) =>
    r.kind === 'powder'
      ? [{ id: r.id, name: r.name, powder: {} as Powder, fit: r.data.fit as UserPowderFit }]
      : [],
  )
}

const previousOf = async (id: string) => (await designs()).find((x) => x.id === id)?.fit?.previous

beforeEach(async () => {
  await deleteRecords((await designs()).map((x) => x.id))
})

describe('deleting a powder of a chain of refits', () => {
  it('relinks the refit of a deleted middle record to its previous', async () => {
    // a <- b <- c, b deleted
    await putRecords([powder(a, 0), powder(b, 1, `user:${a}`), powder(c, 2, `user:${b}`)] as never)
    await deleteRecords([b])
    expect(await previousOf(c)).toBe(`user:${a}`)
    expect(newerFit(await designs(), a)?.id).toBe(c)
  })

  it('relinks through every record deleted in one call', async () => {
    await putRecords([
      powder(a, 0),
      powder(b, 1, `user:${a}`),
      powder(c, 2, `user:${b}`),
      powder(d, 3, `user:${c}`),
    ] as never)
    await deleteRecords([b, c])
    expect(await previousOf(d)).toBe(`user:${a}`)
    expect(newerFit(await designs(), a)?.id).toBe(d)
    // nothing names b after the relink
    expect(newerFit(await designs(), b)).toBeUndefined()
  })

  it('leaves the name of a deleted first record, which still leads to the refit', async () => {
    await putRecords([powder(a, 0), powder(b, 1, `user:${a}`)] as never)
    await deleteRecords([a])
    expect(await previousOf(b)).toBe(`user:${a}`)
    expect(newerFit(await designs(), a)?.id).toBe(b)
  })

  it('does not bridge a record that never came into the store', async () => {
    await putRecords([powder(a, 0), powder(c, 2, `user:${b}`)] as never)
    expect(newerFit(await designs(), a)).toBeUndefined()
    expect(newerFit(await designs(), b)?.id).toBe(c)
  })
})
