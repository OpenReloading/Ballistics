import { beforeEach, expect, it } from 'vitest'
import { english } from '../../src/i18n/translate.ts'
import { parseFiles } from '../../src/lib/load-file-formats.ts'
import { exportAllText, validRecords } from '../../src/lib/user-data.ts'
import type { UserStoreImplementation } from './implementation.ts'
import { bad, badSheet, valid } from './invalid-records.ts'

export function invalidEntries({ store, reset }: UserStoreImplementation) {
  const { deleteRecord, putInvalid, putRecords, storedPhotoIds, storedRecords } = store

  beforeEach(reset)

  it('an Export all file round trips its invalid records as invalid records', async () => {
    const { invalid } = validRecords([bad, badSheet])
    const exported = exportAllText([valid], [], invalid)
    if (!exported.ok) throw new Error(exported.reason)
    const read = await parseFiles(
      [{ name: 'all.json', bytes: new TextEncoder().encode(exported.text) }],
      undefined,
      english.t,
    )
    expect(read.records).toEqual([valid])
    expect(read.invalid).toEqual([bad, badSheet])

    expect(await putInvalid(read.invalid)).toEqual({ added: 2, kept: 0, unstorable: 0 })
    const stored = await storedRecords()
    expect(stored.invalid.map((i) => i.raw)).toEqual([bad, badSheet])
    expect(stored.records).toEqual([])
    // an invalid sheet keeps its photo
    expect(await storedPhotoIds()).toEqual(new Set(['p1']))
  })

  it('an imported invalid record never overwrites a stored record with its id', async () => {
    await putRecords([valid])
    await putInvalid([bad, badSheet])
    const asInvalid = { ...valid, data: 'not an object' }
    const other = { ...bad, name: 'Changed' }
    expect(await putInvalid([asInvalid, other, { name: 'no id' }, null])).toEqual({
      added: 0,
      kept: 2,
      unstorable: 2,
    })
    const stored = await storedRecords()
    expect(stored.records).toEqual([valid])
    // the invalid record of the same id stays as it was too
    expect(stored.invalid.map((i) => i.raw)).toEqual([bad, badSheet])
  })

  it('deletes an invalid record by its id', async () => {
    await putInvalid([bad, badSheet])
    await deleteRecord('old-1')
    expect((await storedRecords()).invalid.map((i) => i.id)).toEqual(['old-2'])
  })
}
