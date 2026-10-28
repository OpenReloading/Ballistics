import { readFileSync } from 'node:fs'
import { checkUserRefs } from '@open-reloading/schema'
import { describe, expect, it } from 'vitest'
import { readLink, shareLink } from '../src/lib/share-link.ts'
import { parseUserDataFile, userDataText } from '../src/lib/user-data.ts'
import { defined } from './defined.ts'

// A user data file with a record of each kind, which the current code must read and write back unchanged, and
// a share link of two of its records. `npm run baselines` at the root rewrites the link from what the code
// writes; the file is edited by hand when the format changes.
const golden = (name: string) => readFileSync(new URL(`golden/${name}`, import.meta.url), 'utf8')
const page = 'https://example.org/bullets/designer'

const parsed = parseUserDataFile(golden('user-data.json'))
const file = parsed.ok ? parsed : undefined

describe('golden user data file', () => {
  it('is read with every record and photo, and no reference left open', () => {
    expect(parsed).toMatchObject({ ok: true })
    const { records, files } = defined(file)
    expect(new Set(records.map((r) => r.kind)).size).toBe(11)
    expect(files).toHaveLength(1)
    expect(checkUserRefs(records)).toEqual([])
  })

  it('is what the current code writes for its records', () => {
    const { records, files } = defined(file)
    // the schema's output may order the keys of a record differently
    expect(JSON.parse(userDataText(records, files))).toEqual(JSON.parse(golden('user-data.json')))
  })
})

describe('golden share link', () => {
  // the user bullet and the user manufacturer it names
  const shared = () => defined(file).records.slice(0, 2)

  it('is read back to its records', async () => {
    expect(await readLink(new URL(golden('share-link.txt').trim()).hash)).toEqual({
      ok: true,
      records: shared(),
      files: undefined,
    })
  })

  it('is what the current code writes for its records', async () => {
    await expect(`${await shareLink(shared(), page)}\n`).toMatchFileSnapshot(
      'golden/share-link.txt',
    )
  })
})
