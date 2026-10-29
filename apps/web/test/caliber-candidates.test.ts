import { toSi } from '@open-reloading/schema'
import { describe, expect, it, vi } from 'vitest'
import {
  type CandidateClass,
  caliberCandidates,
  caliberClassesOf,
  ownCartridges,
} from '../src/lib/caliber-candidates.ts'

const api = vi.hoisted(() => ({
  records: new Map<string, unknown>(),
  faces: { status: 200, items: [] as { id: string; caliberClasses: string[] }[] },
  stored: (): Promise<{ records: unknown[] }> => Promise.resolve({ records: [] }),
}))
vi.mock('../src/lib/api-fetch.ts', () => ({
  fetchRecord: async (kind: string, id: string) => api.records.get(`${kind}/${id}`),
  apiFetch: async () => Response.json({ items: api.faces.items }, { status: api.faces.status }),
}))
vi.mock('../src/lib/face-records.ts', () => ({
  fetchFederationData: async () => ({
    mappings: [{ face: 'issf-10m', event: 'ar60', discipline: 'air-rifle-10m' }],
  }),
}))
vi.mock('../src/lib/user-store.ts', () => ({ storedRecords: () => api.stored() }))

const mm = (v: number) => toSi('length', v)
const nine: CandidateClass = {
  id: 'pistol-9mm',
  name: '9 mm pistol',
  diameter: mm(9.04),
  cartridges: ['9-mm-luger'],
}
const magnum: CandidateClass = {
  id: 'revolver-357-38',
  name: '.357 and .38 revolver',
  diameter: mm(9.12),
  cartridges: ['357-magnum'],
}
const acp: CandidateClass = {
  id: 'pistol-45',
  name: '.45 ACP pistol',
  diameter: mm(11.48),
  cartridges: ['45-acp'],
}
const rimfire: CandidateClass = {
  id: 'rimfire-22',
  name: '.22 rimfire',
  diameter: mm(5.6),
  cartridges: ['22-lr'],
}
const bullet = (v: number) => ({ diameter: mm(v), source: 'bullet' })
const ids = (r: { candidates: CandidateClass[] }) => r.candidates.map((c) => c.id)
const none = new Set<string>()

describe('caliberCandidates', () => {
  it('offers every class of the discipline, none preselected without a hole size', () => {
    const r = caliberCandidates([nine, acp], undefined, none)
    expect(ids(r)).toEqual(['pistol-9mm', 'pistol-45'])
    expect(r.preselected).toBeUndefined()
  })

  it('preselects the class a hole size separates, the other still offered', () => {
    const r = caliberCandidates([nine, acp], bullet(11), none)
    expect(ids(r)).toEqual(['pistol-45', 'pistol-9mm'])
    expect(r.preselected).toBe('pistol-45')
  })

  it('offers both classes of one hole size and preselects neither', () => {
    const r = caliberCandidates([acp, nine, magnum], bullet(9.1), none)
    expect(ids(r).slice(0, 2).toSorted()).toEqual(['pistol-9mm', 'revolver-357-38'])
    expect(r.preselected).toBeUndefined()
  })

  it("puts the user's class first on a tie, still preselecting neither", () => {
    const r = caliberCandidates([nine, magnum, acp], bullet(9.04), new Set(['357-magnum']))
    expect(ids(r)).toEqual(['revolver-357-38', 'pistol-9mm', 'pistol-45'])
    expect(r.preselected).toBeUndefined()
  })

  it("puts the user's class first without a hole size", () => {
    expect(ids(caliberCandidates([nine, acp], undefined, new Set(['45-acp'])))).toEqual([
      'pistol-45',
      'pistol-9mm',
    ])
  })

  it('preselects nothing on a measured hole and puts the classes it fits first', () => {
    // a 9 mm hole in paper at 0.8 of the bullet: nearer 5.6 mm than 9.04 mm by distance alone
    const r = caliberCandidates([rimfire, nine, acp], { diameter: mm(7.2), source: 'typed' }, none)
    expect(ids(r)).toEqual(['pistol-9mm', 'rimfire-22', 'pistol-45'])
    expect(r.preselected).toBeUndefined()
  })

  it('treats a marker like a bullet: its nominal size preselects', () => {
    const r = caliberCandidates([nine, acp], { diameter: mm(9), source: 'marker' }, none)
    expect(r.preselected).toBe('pistol-9mm')
  })

  it("orders a measured hole's fitting classes by the user's first, then by ratio", () => {
    const hole = { diameter: mm(9), source: 'learned' }
    expect(ids(caliberCandidates([acp, magnum, nine], hole, none))).toEqual([
      'pistol-9mm',
      'revolver-357-38',
      'pistol-45',
    ])
    expect(ids(caliberCandidates([acp, nine, magnum], hole, new Set(['45-acp'])))).toEqual([
      'pistol-45',
      'pistol-9mm',
      'revolver-357-38',
    ])
  })

  it('offers nothing for a discipline without classes', () => {
    expect(caliberCandidates([], bullet(9), none)).toEqual({
      candidates: [],
      preselected: undefined,
    })
  })
})

describe('caliberClassesOf', () => {
  const record = (id: string, diameter: number, cartridges: string[]) => ({
    id,
    name: id,
    diameter: { value: diameter },
    cartridges,
  })
  api.records.set('disciplines/air-rifle-10m', { caliberClasses: { ids: ['air-45'] } })
  api.records.set('caliber-classes/air-45', record('air-45', 4.5, []))
  api.records.set('caliber-classes/pistol-9mm', record('pistol-9mm', 9.04, ['9-mm-luger']))

  it('takes the classes of the discipline the face event scores, in m', async () => {
    expect(await caliberClassesOf({ id: 'issf-10m', event: 'ar60' })).toEqual([
      { id: 'air-45', name: 'air-45', diameter: mm(4.5), cartridges: [] },
    ])
  })

  it('takes the classes of the face without a mapped event, leaving out a class not found', async () => {
    api.faces.items = [{ id: 'pistol-25m', caliberClasses: ['pistol-9mm', 'gone'] }]
    expect((await caliberClassesOf({ id: 'pistol-25m' })).map((c) => c.id)).toEqual(['pistol-9mm'])
    expect(await caliberClassesOf({ id: 'other-face' })).toEqual([])
  })

  it('fails when the face list cannot be read', async () => {
    api.faces.status = 503
    await expect(caliberClassesOf({ id: 'pistol-25m' })).rejects.toThrow('Error 503.')
    api.faces.status = 200
  })
})

describe('ownCartridges', () => {
  it('collects the catalogue cartridges of the firearms and loads, nothing else', async () => {
    api.stored = async () => ({
      records: [
        { kind: 'firearm', data: { cartridge: 'catalogue:308-win' } },
        { kind: 'load', data: { cartridge: 'catalogue:9-mm-luger' } },
        { kind: 'load', data: { cartridge: 'user:6a1f0d2e-1b3c-4d5e-8f9a-0b1c2d3e4f5a' } },
        { kind: 'load', data: {} },
        { kind: 'bullet', data: { cartridge: 'catalogue:45-acp' } },
      ],
    })
    expect(await ownCartridges()).toEqual(new Set(['308-win', '9-mm-luger']))
  })

  it('is empty where the store cannot be read', async () => {
    api.stored = () => Promise.reject(new Error('blocked'))
    expect(await ownCartridges()).toEqual(new Set())
  })
})
