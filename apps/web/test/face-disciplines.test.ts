import { readRecords } from '@open-reloading/data'
import type { TargetFace } from '@open-reloading/schema'
import { describe, expect, it } from 'vitest'
import {
  disciplineChoice,
  disciplineFaces,
  disciplineOptions,
  disciplineValue,
  type FederationData,
  mappedFace,
} from '../src/lib/face-disciplines.ts'

const { bundle } = readRecords()
const faces = bundle.targetFaces
const issf = faces.filter((f) => f.organization === 'ISSF')
const own = (f: TargetFace) => ({ ...f, events: f.events.filter((e) => !e.organization) })

describe('disciplines', () => {
  const items = disciplineOptions(faces)

  it('lists every event of every face once, labelled with its organization', () => {
    expect(items).toHaveLength(faces.reduce((n, f) => n + f.events.length, 0))
    expect(new Set(items.map((i) => i.value)).size).toBe(items.length)
    for (const f of faces)
      for (const e of f.events)
        expect(items.find((i) => i.value === `${f.id}|${e.name}`)?.label).toMatch(
          new RegExp(`^${e.organization ?? f.organization} `),
        )
  })

  it('gives every entry its own label, so two entries are never the same choice in the list', () => {
    const norm = (l: string) => l.toLowerCase().replace(/\s+/g, ' ').trim()
    const labels = items.map((i) => norm(i.label))
    expect(labels.filter((l, i) => labels.indexOf(l) !== i)).toEqual([])
    expect(
      items.find((i) => i.value === 'vdrbw-bw-nr2|VdRBw G-RM 1 Militär-Repetiergewehr')?.label,
    ).toBe('VdRBw G-RM 1 Militär-Repetiergewehr (Scheibe Bundeswehr Nr. 2)')
  })

  it('keeps the events of one organization together', () => {
    const a = own(issf[0])
    const b = own(issf[1])
    const other = { ...a, id: 'x-face', organization: 'XYZ' }
    const orgs = disciplineOptions([a, other, b]).map((i) => i.label.split(' ')[0])
    expect(orgs).toEqual([
      ...Array(a.events.length + b.events.length).fill('ISSF'),
      ...Array(other.events.length).fill('XYZ'),
    ])
  })

  it('orders an event of another organization with that organization', () => {
    const a = own(issf[0])
    const b = own(issf[1])
    const face = { ...a, events: [{ ...a.events[0], name: 'XYZ Event', organization: 'XYZ' }] }
    const labels = disciplineOptions([b, face]).map((i) => i.label)
    expect(labels).toEqual([...b.events.map((e) => `ISSF ${e.name}`), 'XYZ Event'])
  })

  it('maps an entry to the face and event a group stores, and back', () => {
    for (const f of faces)
      for (const e of f.events) {
        const value = `${f.id}|${e.name}`
        expect(disciplineValue({ id: f.id, event: e.name })).toBe(value)
        const label = e.organization ? e.name : `${f.organization} ${e.name}`
        // an event on two faces names its face
        expect([label, `${label} (${f.name})`]).toContain(
          items.find((i) => i.value === value)?.label,
        )
        expect(disciplineChoice(value)).toEqual({ id: f.id, event: e.name })
      }
  })

  it('has no entry for a group without an event or without a face', () => {
    expect(disciplineValue({ id: faces[0].id })).toBeNull()
    expect(disciplineValue(undefined)).toBeNull()
  })
})

const data: FederationData = {
  federations: bundle.federations,
  disciplines: bundle.disciplines.map((d) => ({ ...d, distanceMm: d.distance.value })),
  mappings: bundle.targetMappings.map((m) => ({ ...m, gaugeMm: m.gauge?.value })),
}

describe('disciplines of the federations', () => {
  it('lists every discipline once with its own label, and no face event a mapping names', () => {
    const items = disciplineOptions(faces, data)
    const mapped = data.mappings.length
    const events = faces.reduce((n, f) => n + f.events.length, 0)
    expect(items).toHaveLength(data.disciplines.length + events - mapped)
    expect(new Set(items.map((i) => i.label.toLowerCase())).size).toBe(items.length)
    for (const d of data.disciplines) expect(items.map((i) => i.value)).toContain(d.id)
  })

  it('lists only the disciplines of the federation picked', () => {
    const items = disciplineOptions(faces, data, 'issf')
    expect(new Set(items.map((i) => i.value))).toEqual(
      new Set(data.disciplines.filter((d) => d.federation === 'issf').map((d) => d.id)),
    )
    expect(items.every((i) => i.label.startsWith('ISSF '))).toBe(true)
  })

  it('maps a group face and event to its discipline and a discipline to its first face', () => {
    for (const m of data.mappings) {
      expect(disciplineValue({ id: m.face, event: m.event }, data.mappings)).toBe(m.discipline)
      const first = data.mappings.find((x) => x.discipline === m.discipline)
      expect(disciplineChoice(m.discipline, data.mappings)).toEqual({
        id: first?.face,
        event: first?.event,
      })
    }
    expect(disciplineChoice('unknown', data.mappings)).toBeUndefined()
  })

  it('keeps a face event no mapping names as its own entry', () => {
    const extra = { ...faces[0], id: 'x-face', events: [{ ...faces[0].events[0], name: 'Own' }] }
    const items = disciplineOptions([...faces, extra], data)
    expect(items.at(-1)).toEqual({ value: 'x-face|Own', label: `${extra.organization} Own` })
    expect(disciplineValue({ id: 'x-face', event: 'Own' }, data.mappings)).toBe('x-face|Own')
    expect(mappedFace(data.mappings, 'x-face')).toBe(false)
    expect(mappedFace(data.mappings, 'issf-10m-air-rifle')).toBe(true)
  })

  it('gives the faces of a discipline shot in two stages', () => {
    expect(
      disciplineFaces(data.mappings, 'issf-25m-centre-fire-pistol').map((m) => [m.face, m.stage]),
    ).toEqual([
      ['issf-25m-precision-50m-pistol', 'precision stage'],
      ['issf-25m-rapid-fire-pistol', 'rapid-fire stage'],
    ])
  })
})
