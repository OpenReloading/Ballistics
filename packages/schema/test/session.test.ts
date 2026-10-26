import { describe, expect, it } from 'vitest'
import {
  catalogueSession,
  checkUserRefs,
  chronoSession,
  type UserRecords,
  userRecord,
} from '../src/index.ts'
import { expectIssueAt } from './issue-at.ts'

const saved = '2026-10-13T10:00:00.000Z'
const sessionId = '3f1c2b4e-9a7d-4c1e-8b25-6d0f4a9e7c13'
const loadId = '7a2d9c10-5b3e-4f68-9d41-0c8e2b6a1f57'
const sheetId = 'b1c2d3e4-1111-4222-8333-444455556666'
const provenance = { kind: 'measured', sources: [{ title: 'day1.csv' }] }
const shot = (v: number) => ({ velocity: { value: v } })

/** What an import gives and the Measurements tab holds: no id, date, maker, conditions or load yet. */
const fromFile = {
  origin: 'user',
  device: { kind: 'doppler-radar', model: 'Radar' },
  muzzleDistance: { value: 3000 },
  strings: [
    { label: 'A', shots: [shot(800), { ...shot(790), excluded: 'flyer' }] },
    { shots: [shot(810)] },
  ],
  provenance,
}

const catalogue = {
  id: 'example-session',
  origin: 'catalogue',
  date: '2026-10-08',
  device: { kind: 'doppler-radar', manufacturer: 'catalogue:example-maker', model: 'Radar' },
  conditions: { airTemperature: { value: 15 } },
  strings: [{ load: 'catalogue:example-load', shots: [shot(800)] }],
  provenance,
}

const wrap = (id: string, kind: string, data: unknown) => ({ kind, id, name: id, saved, data })

describe('chronoSession', () => {
  it('is one schema for an import, the workbench and the catalogue', () => {
    // an imported file and the session the workbench stores
    expect(chronoSession.parse(fromFile)).toEqual(fromFile)
    const record = userRecord.parse(wrap(sessionId, 'session', fromFile))
    expect(record.kind === 'session' && record.data).toEqual(fromFile)
    // a catalogue session
    expect(catalogueSession.safeParse(catalogue).success).toBe(true)
    // a target sheet's group shot and a load name the stored session by reference
    const ref = `user:${sessionId}`
    const sheet = userRecord.parse(
      wrap(sheetId, 'targetSheet', {
        references: [],
        targetRotation: 0,
        groups: [
          {
            id: 'g1',
            name: 'Group',
            colour: '#336699',
            distance: 100,
            shots: [
              { x: 0, y: 0, placement: 'placed', chrono: { session: ref, string: 0, shot: 1 } },
            ],
          },
        ],
      }),
    )
    const load = userRecord.parse(wrap(loadId, 'load', { origin: 'user', sessions: [ref] }))
    const records = (...rs: unknown[]) => rs as UserRecords
    expect(checkUserRefs(records(sheet, load))).toEqual([
      {
        record: sheetId,
        kind: 'targetSheet',
        field: 'groups.0.shots.0.chrono.session',
        target: ref,
      },
      { record: loadId, kind: 'load', field: 'sessions.0', target: ref },
    ])
    const stored = userRecord.parse(wrap(sessionId, 'session', fromFile))
    expect(checkUserRefs(records(sheet, load, stored))).toEqual([])
  })

  it('asks a catalogue session for what a file does not give', () => {
    for (const path of ['id', 'date', 'device.manufacturer', 'device.model', 'conditions']) {
      const [head = '', tail] = path.split('.')
      const value = structuredClone(catalogue) as Record<string, unknown>
      if (tail) delete (value[head] as Record<string, unknown>)[tail]
      else delete value[head]
      expectIssueAt(
        catalogueSession,
        value,
        path === 'conditions' ? 'conditions.airTemperature' : path,
      )
    }
    expectIssueAt(
      catalogueSession,
      { ...catalogue, strings: [{ shots: [shot(800)] }] },
      'strings.0.load',
    )
    expectIssueAt(
      chronoSession,
      { ...catalogue, strings: [{ load: `user:${loadId}`, shots: [shot(800)] }] },
      'strings.0.load',
    )
    expectIssueAt(catalogueSession, { ...catalogue, origin: 'user' }, 'origin')
  })

  it('keeps what a string varies in its stored unit', () => {
    const strings = (variation: unknown) => [{ variation, shots: [shot(800)] }]
    const charge = { kind: 'charge', value: { value: 2.48 } }
    const seating = { kind: 'seating', value: { value: 71.5 } }
    for (const variation of [charge, seating])
      expect(chronoSession.safeParse({ ...fromFile, strings: strings(variation) }).success).toBe(
        true,
      )
    expectIssueAt(
      chronoSession,
      { ...fromFile, strings: strings({ kind: 'charge', value: { value: 0 } }) },
      'strings.0.variation.value.value',
    )
    expectIssueAt(
      chronoSession,
      { ...fromFile, strings: strings({ kind: 'speed', value: { value: 1 } }) },
      'strings.0.variation',
    )
  })

  it('refuses a string without shots and a session whose provenance is not measured', () => {
    expectIssueAt(chronoSession, { ...fromFile, strings: [{ shots: [] }] }, 'strings.0.shots')
    expectIssueAt(
      chronoSession,
      { ...fromFile, provenance: { ...provenance, kind: 'computed' } },
      'provenance',
    )
  })
})
