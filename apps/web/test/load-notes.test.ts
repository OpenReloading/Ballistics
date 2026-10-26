import { type Load, load, type SessionRecord } from '@open-reloading/schema'
import { describe, expect, it } from 'vitest'
import {
  dismissed,
  effectiveSnapshots,
  type LoadMoment,
  lotsFrom,
  noLots,
  notesOf,
  noteText,
  snapshotOf,
} from '../src/lib/load-notes.ts'
import { toLoad } from '../src/lib/load-record.ts'
import { sessionRef } from '../src/lib/measurements.ts'
import { presetUnits } from '../src/lib/units.ts'

const metric = presetUnits('metric-grams')

const idA = '3f1c2b4e-9a7d-4c1e-8b25-6d0f4a9e7c13'
const idB = '7a2d9c10-5b3e-4f68-9d41-0c8e2b6a1f57'
const [a, b] = [sessionRef(idA), sessionRef(idB)]
const gram = 0.001
const record = (id: string, name: string, date: string, velocities: number[]): SessionRecord => ({
  kind: 'session',
  id,
  name,
  saved: '2026-10-01T10:00:00.000Z',
  data: {
    origin: 'user',
    date,
    device: { kind: 'optical' },
    strings: [
      {
        variation: { kind: 'charge', value: { value: 2.8 } },
        shots: velocities.map((value) => ({ velocity: { value } })),
      },
      { shots: [{ velocity: { value: 100 } }] },
    ],
    provenance: { kind: 'measured', sources: [{ title: name }] },
  },
})
const now: LoadMoment = {
  lots: { powder: ' P1 ', primer: 'R1', case: 'C1' },
  seating: { by: 'overallLength', value: 70.8 },
  roundCount: 120,
}

describe('snapshotOf', () => {
  it('keeps the lots typed, the seating and the round count, and no empty lot', () => {
    expect(snapshotOf(a, now)).toEqual({
      session: a,
      powderLot: 'P1',
      primerLot: 'R1',
      caseLot: 'C1',
      seating: { by: 'overallLength', value: { value: 70.8 } },
      roundCount: 120,
    })
    expect(snapshotOf(a, { lots: noLots })).toEqual({ session: a })
  })

  it('keeps a stored snapshot and takes the load as it is for a session without one', () => {
    const stored = { session: a, powderLot: 'old' }
    expect(effectiveSnapshots([a, b], [stored], now)).toEqual([stored, snapshotOf(b, now)])
    expect(effectiveSnapshots([b], [stored], now)).toEqual([snapshotOf(b, now)])
  })

  it('dismisses a rule once and stores only its session, the others stay live', () => {
    const live = effectiveSnapshots([a, b], [], now)
    const once = dismissed([], live, b, 'seating')
    expect(once).toEqual([{ ...snapshotOf(b, now), dismissed: ['seating'] }])
    const again = dismissed(once, effectiveSnapshots([a, b], once, now), b, 'seating')
    expect(again).toEqual(once)
    expect(dismissed(once, live, a, 'powderLot').map((s) => s.session)).toEqual([b, a])
    expect(dismissed(once, live, 'user:none', 'seating')).toEqual(once)
  })
})

describe('notesOf', () => {
  const records = [
    record(idA, 'First', '2026-05-01', [800, 805, 795]),
    record(idB, 'Second', '2026-06-01', [830, 835, 825]),
  ]
  const snaps = [
    { ...snapshotOf(a, now) },
    { ...snapshotOf(b, { ...now, lots: { ...now.lots, powder: 'P2' } }) },
  ]

  it('reads the velocity of the strings mapped to the load charge only', () => {
    const notes = notesOf([a, b], snaps, records, 2.8 * gram, undefined)
    expect(notes.map((n) => n.rule)).toEqual(['powderLot', 'velocity'])
    expect(notes[1]).toMatchObject({ before: 800, now: 830, spread: 5 })
    expect(notesOf([a, b], snaps, records, 2.9 * gram, undefined).map((n) => n.rule)).toEqual([
      'powderLot',
    ])
    expect(notesOf([a, b], snaps, records, undefined, undefined).map((n) => n.rule)).toEqual([
      'powderLot',
    ])
  })

  it('compares sessions this browser has no record of by their snapshots alone', () => {
    const rules = notesOf([a, b], snaps, [], 2.8 * gram, undefined).map((n) => n.rule)
    expect(rules).toEqual(['powderLot'])
  })

  it('words a note with its values, units and sessions, and no verdict', () => {
    const name = (ref: string) => (ref === a ? 'First' : 'Second')
    const text = notesOf([a, b], snaps, records, 2.8 * gram, undefined).map((n) =>
      noteText(n, name, metric),
    )
    expect(text[0]).toBe('Powder lot is P2 in Second and was P1 in First.')
    expect(text[1]).toMatch(
      /^Mean velocity is 830\.?\d* m\/s in Second and was 800\.?\d* m\/s in First/,
    )
    const seat = notesOf(
      [a, b],
      [
        snaps[0] ?? snapshotOf(a, now),
        snapshotOf(b, { ...now, seating: { by: 'overallLength', value: 71.3 } }),
      ],
      [],
      undefined,
      undefined,
    )
    expect(noteText(seat[0] ?? never(), name, metric)).toContain('71.3')
    const text2 = [
      ...text,
      noteText(
        { rule: 'roundCount', session: b, earlier: a, now: 650, before: 400, threshold: 500 },
        name,
        metric,
      ),
      noteText(
        { rule: 'caseLot', session: b, earlier: a, change: 'missing', before: 'C1' },
        name,
        metric,
      ),
    ].join(' ')
    expect(text2).not.toMatch(/safe|unsafe|recommend|reduce|increase/i)
    expect(text2).toContain('you set a note at 500 rounds')
    expect(text2).toContain('Case lot is not recorded for Second. First has C1.')
  })
})

function never(): never {
  throw new Error('missing')
}

describe('saved load', () => {
  const parts = {
    values: {},
    given: new Set<string>(),
    notes: '',
    sessions: [a, b],
    lots: now.lots,
    snapshots: effectiveSnapshots([a, b], [], now),
  }

  it('keeps lots and snapshots and passes the schema; an empty lot is left out', () => {
    const saved = toLoad(parts)
    expect(saved).toMatchObject({
      powderLot: 'P1',
      case: { lot: 'C1' },
      snapshots: [{ session: a }, { session: b }],
    })
    expect(saved.primer).toEqual({ lot: 'R1' })
    expect(load.safeParse(JSON.parse(JSON.stringify(saved))).success).toBe(true)
    expect(lotsFrom(saved as Load)).toEqual({ powder: 'P1', primer: 'R1', case: 'C1' })
    const bare = toLoad({ ...parts, lots: noLots, snapshots: [], sessions: [] })
    expect([bare.powderLot, bare.primer, bare.case]).toEqual([undefined, undefined, undefined])
    expect(bare.snapshots).toBeUndefined()
  })
})
