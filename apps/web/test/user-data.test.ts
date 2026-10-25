import {
  type UserRecord,
  userDataFormat,
  userDataVersion,
  userRecord,
} from '@open-reloading/schema'
import { describe, expect, it } from 'vitest'
import { exampleFirearm } from '../src/lib/example-data.ts'
import { parseFiles, readLoadFile } from '../src/lib/load-file-formats.ts'
import { maxLinkChars, readLink, shareLink, shareProblem } from '../src/lib/share-link.ts'
import {
  canonicalJson,
  checkedUserDataText,
  exportAllText,
  makerRecordsOf,
  makersToCarry,
  maxFileBytes,
  parseUserDataFile,
  planImport,
  refNote,
  tooLargeMessage,
  userDataText,
  validRecords,
} from '../src/lib/user-data.ts'
import { folderFileName, ownsFile, recordFileName } from '../src/lib/user-file-names.ts'
import { droppedPhotos, embeddedFileBlob, embedFiles, photoIds } from '../src/lib/user-photos.ts'
import { defined } from './defined.ts'

const saved = '2026-10-13T10:00:00.000Z'
const bullet: UserRecord = {
  kind: 'bullet',
  id: '9b8a7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d',
  name: 'Example 168 gr',
  saved,
  data: {
    origin: 'user',
    manufacturer: 'catalogue:example-a',
    overrides: {
      name: '168 gr',
      diameter: { value: 7.82 },
      mass: { value: 10.8862 },
      base: { type: 'boat-tail' },
      ogive: { form: 'tangent' },
    },
  },
}
const load: UserRecord = {
  kind: 'load',
  id: 'w1',
  name: '308 Win.',
  saved,
  data: {
    origin: 'user',
    charge: { value: 2.8 },
    cartridge: 'catalogue:308-win',
    note: 'first ladder',
  },
}

const makerId = '3f1c2b4e-9a7d-4c1e-8b25-6d0f4a9e7c13'
const maker: UserRecord = {
  kind: 'manufacturer',
  id: makerId,
  name: 'Home Loader',
  saved,
  data: { origin: 'user' },
}
const madeBullet: UserRecord = {
  ...bullet,
  data: { ...bullet.data, manufacturer: `user:${makerId}` },
} as UserRecord

describe('user data files', () => {
  it('round trip: a file of records parses to equal records', () => {
    const parsed = parseUserDataFile(userDataText([bullet, load]))
    expect(parsed).toEqual({ ok: true, records: [bullet, load] })
  })

  it('rejects text that is not JSON, another format and a newer version with a reason', () => {
    expect(parseUserDataFile('{')).toEqual({ ok: false, reason: 'The file is not JSON.' })
    const other = parseUserDataFile(JSON.stringify({ format: 'x', version: 1, records: [] }))
    expect(other.ok).toBe(false)
    const newer = parseUserDataFile(
      JSON.stringify({ format: 'openreloading-user-data', version: 2, records: [] }),
    )
    expect(newer).toEqual({
      ok: false,
      reason: 'The file has format version 2; this app reads version 1.',
    })
  })

  it('refuses another version, naming the version it reads, and writes version 1', () => {
    const v4 = JSON.stringify({ format: 'openreloading-user-data', version: 4, records: [bullet] })
    expect(parseUserDataFile(v4)).toEqual({
      ok: false,
      reason: 'The file has format version 4; this app reads version 1.',
    })
    expect(JSON.parse(userDataText([bullet])).version).toBe(1)
  })

  it('skips a file with one invalid record as a whole and names the field', () => {
    const bad = { ...bullet, data: { ...bullet.data, overrides: { mass: { value: 'heavy' } } } }
    const { records, skipped } = parseFiles([
      { name: 'good.json', text: userDataText([load]) },
      { name: 'bad.json', text: userDataText([load, bad as unknown as UserRecord]) },
    ])
    expect(records).toEqual([load])
    expect(skipped).toHaveLength(1)
    expect(defined(skipped[0]).name).toBe('bad.json')
    expect(defined(skipped[0]).reason).toContain('records[1].data.overrides.mass.value')
  })

  it('skips a file over the size limit', () => {
    const { skipped } = parseFiles([
      { name: 'big.json', text: ' '.repeat(maxFileBytes + 1) },
      { name: 'unread.json' },
    ])
    expect(skipped.map((s) => s.reason)).toEqual([
      'The file is larger than 40 MB.',
      'The file is larger than 40 MB.',
    ])
  })

  it('keeps hostile text as plain data', () => {
    const hostile = {
      ...load,
      name: '<img src=x onerror=alert(1)>',
      data: { origin: 'user', note: '"};' },
    }
    const parsed = parseUserDataFile(userDataText([hostile as UserRecord]))
    expect(parsed.ok && defined(parsed.records[0]).name).toBe('<img src=x onerror=alert(1)>')
    const polluting = userDataText([load]).replace(
      '"kind"',
      '"__proto__": { "polluted": true }, "kind"',
    )
    const result = parseUserDataFile(polluting)
    expect(result.ok && Object.keys(defined(result.records[0]))).not.toContain('__proto__')
    expect(({} as Record<string, unknown>).polluted).toBeUndefined()
  })

  it('plans an import: new records added, equal ones left, other content asked', () => {
    const changed: UserRecord = {
      ...load,
      saved: '2026-10-14T10:00:00.000Z',
      data: { origin: 'user', charge: { value: 3 } },
    }
    const sameData = { ...bullet, saved: '2026-10-14T10:00:00.000Z' }
    const fresh = { ...load, id: 'w2' }
    expect(planImport([sameData, changed, fresh], [bullet, load])).toEqual({
      added: [fresh],
      equal: [sameData],
      conflicts: [{ incoming: changed, stored: load }],
    })
  })

  it('names the photos of replaced target sheets that no stored record points at any more', () => {
    const sheet = (id: string, photo?: string): UserRecord => ({
      kind: 'targetSheet',
      id,
      name: id,
      saved: '2026-10-15T10:00:00.000Z',
      data: { references: [], targetRotation: 0, groups: [], ...(photo && { photo }) },
    })
    const before = [sheet('s1', 'p1'), sheet('s2', 'p2'), sheet('s3', 'p3'), sheet('s4')]
    const after = [
      sheet('s1', 'p9'),
      sheet('s2', 'p2'),
      sheet('s3'),
      sheet('s4'),
      sheet('s5', 'p3'),
    ]
    // p1 replaced, p2 kept, p3 dropped by s3 but still held by s5
    expect(droppedPhotos(before, after)).toEqual(['p1'])
    expect(droppedPhotos([load, bullet], [])).toEqual([])
  })

  it('round trip: a sheet with its photo, the bytes unchanged', async () => {
    // 300 kB: more bytes than one String.fromCharCode spread takes
    const bytes = Uint8Array.from({ length: 300_000 }, (_, i) => (i * 7) % 256)
    const sheet: UserRecord = {
      kind: 'targetSheet',
      id: 's1',
      name: 'Sheet',
      saved,
      data: {
        photo: 'p1',
        references: [],
        targetRotation: 0,
        groups: [],
        notes: [{ id: 'n1', x: 0, y: 0.01, text: '{extremeSpread.moa}' }],
        overlays: { stats: true },
      },
    }
    expect(photoIds([sheet, load])).toEqual(['p1'])
    const files = await embedFiles([{ id: 'p1', blob: new Blob([bytes], { type: 'image/jpeg' }) }])
    const parsed = parseUserDataFile(userDataText([sheet], files))
    if (!parsed.ok) throw new Error(parsed.reason)
    expect(parsed.records).toEqual([sheet])
    expect(parsed.files?.map((f) => [f.id, f.type])).toEqual([['p1', 'image/jpeg']])
    const back = embeddedFileBlob(parsed.files?.[0] as NonNullable<typeof parsed.files>[number])
    expect(back.type).toBe('image/jpeg')
    expect(new Uint8Array(await back.arrayBuffer())).toEqual(bytes)
    // a file without photos parses as before
    expect(parseUserDataFile(userDataText([load]))).toEqual({ ok: true, records: [load] })
  })

  it('gives the text of a file with its photos, or the reason Import would refuse it', () => {
    const sheet: UserRecord = {
      kind: 'targetSheet',
      id: 's1',
      name: 'Sheet',
      saved,
      data: { photo: 'p1', references: [], targetRotation: 0, groups: [] },
    }
    const photo = { id: 'p1', type: 'image/jpeg' as const, data: 'AAAA' }
    const small = checkedUserDataText([sheet, load], [photo])
    if (!small.ok) throw new Error(small.reason)
    expect(parseUserDataFile(small.text)).toMatchObject({ ok: true, files: [photo] })
    expect(checkedUserDataText([sheet], [{ ...photo, data: 'A'.repeat(maxFileBytes) }])).toEqual({
      ok: false,
      reason: tooLargeMessage,
    })
  })

  it('measures a text in UTF-8 bytes, as the file Open reads', () => {
    const text = `"${'ü'.repeat(maxFileBytes / 2)}"`
    expect(parseUserDataFile(text)).toEqual({ ok: false, reason: tooLargeMessage })
  })

  it('exports every record, leaving out the photos past the size limit', () => {
    const sheet = (id: string, photo: string): UserRecord => ({
      kind: 'targetSheet',
      id,
      name: id,
      saved,
      data: { photo, references: [], targetRotation: 0, groups: [] },
    })
    const photo = (id: string, chars: number) => ({
      id,
      type: 'image/jpeg' as const,
      data: 'A'.repeat(chars),
    })
    const records = [sheet('s1', 'p1'), sheet('s2', 'p2'), sheet('s3', 'p3'), load]
    const small = [photo('p1', 4), photo('p2', 8)]
    expect(exportAllText(records, small)).toEqual({
      ...checkedUserDataText(records, small),
      left: [],
    })
    const big = maxFileBytes * 0.6
    const out = exportAllText(records, [photo('p1', big), photo('p2', big), photo('p3', 4)])
    if (!out.ok) throw new Error(out.reason)
    expect(out.left).toEqual(['p2'])
    expect(out.text.length).toBeLessThanOrEqual(maxFileBytes)
    expect(parseUserDataFile(out.text)).toMatchObject({
      ok: true,
      records,
      files: [{ id: 'p1' }, { id: 'p3' }],
    })
    // records too large without any photo are refused
    expect(exportAllText([{ ...load, name: 'A'.repeat(maxFileBytes) }])).toEqual({
      ok: false,
      reason: tooLargeMessage,
    })
  })

  it('compares data whatever the key order', () => {
    expect(canonicalJson({ b: 1, a: { d: 2, c: [3] } })).toBe(
      canonicalJson({ a: { c: [3], d: 2 }, b: 1 }),
    )
  })

  it('names a file after the record', () => {
    expect(recordFileName('Example 168 gr. HPBT')).toBe('example-168-gr-hpbt.json')
    expect(recordFileName('***')).toBe('record.json')
  })

  it('writes back only over a file that holds just this record', () => {
    expect(ownsFile(userDataText([bullet]), '9b8a7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d')).toBe(true)
    // an Export all file holding this record and others is never overwritten by one record
    expect(ownsFile(userDataText([bullet, load]), '9b8a7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d')).toBe(
      false,
    )
    expect(ownsFile(userDataText([bullet]), 'other')).toBe(false)
    expect(ownsFile('not json', '9b8a7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d')).toBe(false)
  })

  it('writes back over a file of this record and the user manufacturer it names', () => {
    expect(ownsFile(userDataText([madeBullet, maker]), bullet.id)).toBe(true)
    // a manufacturer the record does not name, or another record, makes it a collection
    expect(ownsFile(userDataText([bullet, maker]), bullet.id)).toBe(false)
    expect(ownsFile(userDataText([madeBullet, maker, load]), bullet.id)).toBe(false)
    // two records of the same id do not make a file of one
    expect(ownsFile(userDataText([madeBullet, madeBullet, maker]), bullet.id)).toBe(false)
  })

  it('picks a folder file name that holds no other record', async () => {
    const files: Record<string, string> = {
      'new-bullet.json': userDataText([bullet]),
      'new-bullet-2.json': userDataText([load]),
      'mine.json': userDataText([load]),
    }
    const read = async (name: string) => files[name]
    expect(
      await folderFileName('new-bullet.json', '1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f', read),
    ).toBe('new-bullet-3.json')
    expect(
      await folderFileName('new-bullet.json', '9b8a7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d', read),
    ).toBe('new-bullet.json')
    expect(await folderFileName('mine.json', 'w1', read)).toBe('mine.json')
    expect(await folderFileName('free.json', '1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f', read)).toBe(
      'free.json',
    )
  })

  it('treats an empty text like an absent one when comparing', () => {
    expect(canonicalJson({ origin: 'user', note: '' })).toBe(canonicalJson({ origin: 'user' }))
  })

  it('keeps only schema-valid records read from the browser store', () => {
    const bad = { ...bullet, id: '' }
    const old = { kind: 'bulletDesign', id: 'o1', name: 'Old', saved, data: 'not an object' }
    const { records, invalid } = validRecords([bullet, bad, null, load, old])
    expect(records).toEqual([bullet, load])
    // kept as stored, with the schema's error and what names it
    expect(invalid.map((i) => i.raw)).toEqual([bad, null, old])
    expect(invalid[2]).toMatchObject({ id: 'o1', name: 'Old', kind: 'bulletDesign' })
    expect(defined(invalid[2]).error).toContain('kind')
    expect(invalid[1]).toMatchObject({ id: undefined, name: undefined, kind: undefined })
  })

  it('names the earlier load format in a stored record, an opened file and a pasted text', () => {
    const old = {
      kind: 'workbenchState',
      id: 'w9',
      name: 'Old load',
      saved,
      data: { siValues: { charge: 0.0028 }, cartridge: '308-win' },
    }
    const stored = defined(validRecords([old]).invalid[0])
    expect(stored.error).toContain('earlier version')
    expect(stored).toMatchObject({ id: 'w9', kind: 'workbenchState' })
    const text = JSON.stringify({
      format: userDataFormat,
      version: userDataVersion,
      records: [old],
    })
    const parsed = parseUserDataFile(text)
    expect(!parsed.ok && parsed.reason).toContain('earlier version')
    const read = readLoadFile(text)
    expect(!read.ok && read.reason).toContain('earlier version')
  })

  it('Export all carries the invalid records as stored; parsing hands them on unchecked', () => {
    const old = { kind: 'bulletDesign', id: 'o1', name: 'Old', saved, data: 'not an object' }
    const { invalid } = validRecords([old])
    const out = exportAllText([bullet], [], invalid)
    expect(out.ok && JSON.parse(out.text).invalid).toEqual([old])
    expect(out.ok && parseUserDataFile(out.text)).toEqual({
      ok: true,
      records: [bullet],
      invalid: [old],
    })
    // no invalid records: the file has no such field
    const plain = exportAllText([bullet])
    expect(plain.ok && 'invalid' in JSON.parse(plain.text)).toBe(false)
  })
})

describe('the user manufacturer of a record', () => {
  it('is the stored record a bullet or firearm names by a user reference', () => {
    const other = { ...maker, id: '0a1b2c3d-0000-4000-8000-000000000001', name: 'Other' }
    expect(makerRecordsOf(madeBullet, [load, other, maker])).toEqual([maker])
    expect(makerRecordsOf(madeBullet, [other])).toEqual([])
  })

  it('is the case manufacturer of a case capacity', () => {
    const capacity = {
      kind: 'caseCapacity',
      id: 'c1',
      name: 'Capacity',
      saved,
      data: { origin: 'user', caseManufacturer: `user:${makerId}` },
    } as unknown as UserRecord
    expect(makerRecordsOf(capacity, [maker])).toEqual([maker])
  })

  it('is none for a catalogue manufacturer, no manufacturer or another kind', () => {
    expect(makerRecordsOf(bullet, [maker])).toEqual([])
    expect(makerRecordsOf({ ...bullet, data: { origin: 'user' } } as UserRecord, [maker])).toEqual(
      [],
    )
    expect(makerRecordsOf(load, [maker])).toEqual([])
  })

  it('is the stored maker, else the one that came with the opened file', () => {
    const renamed = { ...maker, name: 'From the file' }
    expect(makersToCarry(madeBullet, [maker], [renamed])).toEqual([maker])
    expect(makersToCarry(madeBullet, [], [renamed])).toEqual([renamed])
    expect(makersToCarry(madeBullet, [], [])).toEqual([])
  })

  it('travels with the record in a file and a share link', async () => {
    const records = [madeBullet, ...makerRecordsOf(madeBullet, [maker])]
    expect(parseUserDataFile(userDataText(records))).toEqual({ ok: true, records })
    const link = (await shareLink(records, 'https://example.org/bullets/designer')) as string
    expect(await readLink(new URL(link).hash)).toEqual({ ok: true, records })
  })
})

describe('share links', () => {
  const base = 'https://example.org/bullets/designer'

  it('round trip: a link of a record reads back to the same record', async () => {
    const link = (await shareLink([bullet], base)) as string
    expect(link).toMatch(/^https:\/\/example\.org\/bullets\/designer#record=[\w-]+$/)
    expect(await readLink(new URL(link).hash)).toEqual({ ok: true, records: [bullet] })
  })

  it('replaces the fragment of the page and writes the padding-free URL alphabet', async () => {
    for (const page of [`${base}#old`, `${base}#a#b`, `${base}#`]) {
      const link = (await shareLink([bullet], page)) as string
      expect(link).toMatch(/^https:\/\/example\.org\/bullets\/designer#record=[\w-]+$/)
    }
  })

  it('refuses a record whose link is longer than the limit', async () => {
    // random text does not compress
    const noise = Array.from({ length: 12000 }, () => Math.random().toString(36)[2]).join('')
    const big = { ...load, data: { ...load.data, notes: noise } } as UserRecord
    await expect(shareLink([big], base)).resolves.toBeUndefined()
    expect(maxLinkChars).toBe(8000)
  })

  it('rejects a damaged or invalid fragment with a reason', async () => {
    expect(await readLink('#record=@@@')).toEqual({ ok: false, reason: 'The link is damaged.' })
    const invalid = {
      ...bullet,
      data: { ...bullet.data, overrides: { mass: { value: 'heavy' } } },
    } as never
    const link = await shareLink([invalid], base)
    const read = await readLink(new URL(link as string).hash)
    expect(read?.ok).toBe(false)
    expect(read && !read.ok && read.reason).toContain('data.overrides.mass.value')
  })

  it('refuses a link for a load that refers to records of this browser, naming the fields', () => {
    const own = (fields: object) => ({ ...load, data: { ...load.data, ...fields } }) as UserRecord
    const userId = '3f1c2b4e-9a7d-4c1e-8b25-6d0f4a9e7c13'
    const refused = shareProblem(own({ cartridge: `user:${userId}`, firearm: `user:${userId}` }))
    expect(refused).toContain('(firearm, cartridge)')
    expect(shareProblem(own({ cartridge: 'catalogue:308-win' }))).toBeUndefined()
    expect(shareProblem(load)).toBeUndefined()
    // a design carries its base as a catalogue reference and its maker as a name only
    expect(
      shareProblem({
        ...bullet,
        data: { ...bullet.data, manufacturer: `user:${userId}` },
      } as UserRecord),
    ).toBeUndefined()
  })

  it('ignores a fragment without a record', async () => {
    expect(await readLink('#results')).toBeUndefined()
    expect(await readLink('')).toBeUndefined()
  })
})

describe('refNote', () => {
  const gunId = '6f0f4d3e-0a43-4a43-9a3d-3a2f2e1f0c21'
  const withFirearm = (firearm: string): UserRecord => ({
    ...load,
    data: { ...load.data, firearm },
  })
  const rifle = {
    kind: 'firearm',
    id: gunId,
    name: 'Rifle',
    saved,
    data: {
      origin: 'user',
      name: 'Rifle',
      barrelLength: { value: 600 },
      twist: { value: 250 },
      twistHand: 'right',
      optics: [],
      configurations: [],
    },
  } as UserRecord

  it('names the records whose reference points at no record', () => {
    expect(refNote([withFirearm('user:2b8e1d7c-4f3a-4a6e-9d51-7c0a3e5b9f12')], [])).toBe(
      'Not found: 308 Win.: the firearm user:2b8e1d7c-4f3a-4a6e-9d51-7c0a3e5b9f12 is not in this browser.',
    )
  })

  it('is empty when the browser holds the referenced record, or the opened ones do', () => {
    expect(refNote([withFirearm(`user:${gunId}`)], [rifle])).toBe('')
    expect(refNote([withFirearm(`user:${gunId}`), rifle], [])).toBe('')
  })

  it('finds the built-in example rifle where it is passed with the stored records', () => {
    expect(
      refNote([withFirearm(`user:${exampleFirearm.id}`)], [userRecord.parse(exampleFirearm)]),
    ).toBe('')
  })

  it('does not report a stored record that is not opened', () => {
    expect(refNote([bullet], [withFirearm('user:2b8e1d7c-4f3a-4a6e-9d51-7c0a3e5b9f12')])).toBe('')
  })
})
