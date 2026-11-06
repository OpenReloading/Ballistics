import { readFileSync } from 'node:fs'
import type { UserRecord } from '@open-reloading/schema'
import { checkUserRefs, userDataVersion, userRecord } from '@open-reloading/schema'
import { describe, expect, it } from 'vitest'
import { readLink, shareLink } from '../src/lib/share-link.ts'
import { parseUserDataFile, userDataText } from '../src/lib/user-data.ts'
import { defined } from './defined.ts'

// The current format version only: a user data file with a record of each kind and a second one that sets
// every field the kind can have, which the current code reads and writes back as the same JSON value, and share
// links of its records, one of them with text beyond ASCII. A new version replaces these files; no older one is
// read. `pnpm run baselines` at the root rewrites the links from what the code writes; the file is edited by hand
// when the format changes.
const golden = (name: string) => readFileSync(new URL(`golden/${name}`, import.meta.url), 'utf8')
const page = 'https://example.org/bullets/designer'
/** A share link with its fragment inflated back to the file text. */
const inflated = async (link: string) => {
  const [base = '', fragment = ''] = link.split('#record=')
  const bytes = Uint8Array.from(atob(fragment.replace(/-/g, '+').replace(/_/g, '/')), (c) =>
    c.charCodeAt(0),
  )
  const text = await new Response(
    new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw')),
  ).text()
  return `${base}#${text}`
}

const fileText = golden(`user-data-v${userDataVersion}.json`)
const parsed = parseUserDataFile(fileText)
const file = parsed.ok ? parsed : undefined

/** The kinds a file of this version holds: every kind the schema reads. */
const kinds = userRecord.options.map((o) => o.shape.kind.value)

/** An object of the user data file's JSON Schema. */
interface Node {
  not?: object
  properties?: Record<string, Node>
}
/** The fields `n` allows, without those of an earlier format that a file must not have (`{ not: {} }`). */
const fieldsOf = (n: Node) =>
  Object.entries(n.properties ?? {}).flatMap(([k, v]) =>
    v.not && Object.keys(v.not).length === 0 ? [] : [k],
  )

describe('golden user data file of the current version', () => {
  it('is read by the current code with its photo and no reference left open', () => {
    expect(parsed).toMatchObject({ ok: true })
    const { records, files } = defined(file)
    expect(records.length).toBeGreaterThan(0)
    expect(files).toHaveLength(1)
    expect(checkUserRefs(records)).toEqual([])
  })

  it('has a record of every kind', () => {
    expect(new Set(defined(file).records.map((r) => r.kind))).toEqual(new Set(kinds))
  })

  // the fields of a record and of its data and imported block, which hold no union; deeper parts are in the
  // records that have them, not checked here
  it('sets every field each kind can have, on the record and in its data', () => {
    const schema = JSON.parse(
      readFileSync(
        new URL(
          '../../../packages/schema/test/golden/json-schema/user-data-file.schema.json',
          import.meta.url,
        ),
        'utf8',
      ),
    )
    const records: Record<string, unknown>[] = JSON.parse(fileText).records
    const branchesOfKinds: (Node & { properties: { kind: { const: string } } })[] =
      schema.properties.records.items.oneOf
    const missing = branchesOfKinds.flatMap((branch) => {
      const kind = branch.properties.kind.const
      const ofKind = records.filter((r) => r['kind'] === kind)
      return fieldsOf(branch).flatMap((k) => {
        const values = ofKind.flatMap((r) => (r[k] === undefined ? [] : [r[k]]))
        if (values.length === 0) return [`${kind}.${k}`]
        const set = new Set(
          values.flatMap((v) => (v && typeof v === 'object' ? Object.keys(v) : [])),
        )
        return fieldsOf(branch.properties[k] ?? {}).flatMap((f) =>
          set.has(f) ? [] : [`${kind}.${k}.${f}`],
        )
      })
    })
    expect(missing).toEqual([])
  })

  it('is what the current code writes for its records', () => {
    const { records, files } = defined(file)
    // the schema's output may order the keys of a record differently
    expect(JSON.parse(userDataText(records, files))).toEqual(JSON.parse(fileText))
  })

  it('is refused as a whole in the next version, and names both versions', () => {
    const next = fileText.replace(
      `"version": ${userDataVersion},`,
      `"version": ${userDataVersion + 1},`,
    )
    expect(parseUserDataFile(next)).toEqual({
      ok: false,
      reason: `The file has format version ${userDataVersion + 1}; this app reads version ${userDataVersion}.`,
    })
  })
})

describe.each([
  // the user bullet and the user manufacturer it names
  { name: 'share-link', pick: (records: UserRecord[]) => records.slice(0, 2) },
  // a competition event: its name and place beyond ASCII, its references to this browser kept as they are
  {
    name: 'share-link-text',
    pick: (records: UserRecord[]) => records.filter((r) => r.kind === 'event').slice(0, 1),
  },
])('golden $name', ({ name, pick }) => {
  const shared = () => pick(defined(file).records)
  const stored = () => golden(`${name}-v${userDataVersion}.txt`).trim()

  it('is read back to its records', async () => {
    expect(shared()).not.toHaveLength(0)
    expect(await readLink(new URL(stored()).hash)).toEqual({
      ok: true,
      records: shared(),
      files: undefined,
    })
  })

  it('is what the current code writes for its records', async () => {
    const written = defined(await shareLink(shared(), page))
    // zlib builds compress the same text to different bytes: the stored link stands while it holds the same text
    const link = (await inflated(written)) === (await inflated(stored())) ? stored() : written
    await expect(`${link}\n`).toMatchFileSnapshot(`golden/${name}-v${userDataVersion}.txt`)
  })
})
