import 'fake-indexeddb/auto'
import {
  type Load,
  type SessionRecord,
  type SessionSnapshot,
  type UserRecord,
  userId,
  userRecord,
} from '@open-reloading/schema'
import { expect, it } from 'vitest'
import { nth } from '../src/lib/nth.ts'
import {
  addShot,
  conditionsText,
  mergeSessionRefs,
  parseVelocity,
  parseWeather,
  type RangeContext,
  rangeExcluded,
  rangeSessionId,
  rangeStats,
  rangeSteps,
  setExcluded,
  setNotes,
  withSession,
  withStoredSessions,
} from '../src/lib/range-entry.ts'
import { presetUnits, withUnit } from '../src/lib/units.ts'
import { storedRecord, updateRecord } from '../src/lib/user-store.ts'
import { defined } from './defined.ts'

const loadRef = 'user:7a2d9c10-5b3e-4f68-9d41-0c8e2b6a1f57'
const context: RangeContext = {
  id: '3f1c2b4e-9a7d-4c1e-8b25-6d0f4a9e7c13',
  name: 'Range 2026-10-27',
  loadRef,
  now: new Date(2026, 9, 27, 10, 30),
}
const load = (analysis?: Load['analysis'], charge: number | null = 42.5) =>
  ({
    origin: 'user',
    ...(charge !== null && { charge: { value: charge } }),
    ...(analysis && { analysis }),
  }) as Load

type SessionString = SessionRecord['data']['strings'][number]

const session = (r: unknown) => {
  const parsed = userRecord.parse(r)
  if (parsed.kind !== 'session') throw new Error('not a session')
  return parsed
}

it('lists the rungs of a charge ladder lowest first, centred, up or down from the charge', () => {
  const around = rangeSteps(load({ ladder: { stepCount: 3, step: 0.5, direction: 'around' } }))
  expect(around.map((s) => s.charge)).toEqual([42, 42.5, 43])
  expect(around.map((s) => s.offset)).toEqual([-1, 0, 1])
  expect(
    rangeSteps(load({ ladder: { stepCount: 3, step: 0.5, direction: 'down' } })).map(
      (s) => s.charge,
    ),
  ).toEqual([41.5, 42, 42.5])
  expect(
    rangeSteps(load({ ladder: { stepCount: 2, step: 0.1, direction: 'up' } })).map((s) => s.charge),
  ).toEqual([42.5, 42.6])
})

it('gives a load without a charge ladder one step', () => {
  expect(rangeSteps(load())).toEqual([{ key: 'charge:42.5000', offset: 0, charge: 42.5 }])
  expect(rangeSteps(load(undefined, null))).toEqual([
    { key: 'load', offset: undefined, charge: undefined },
  ])
  // a seating ladder varies another quantity: the string is the load as it is
  const seating = load({ ladder: { kind: 'seating', stepCount: 3, step: 0.1, direction: 'up' } })
  expect(rangeSteps(seating)).toHaveLength(1)
})

const ladder = rangeSteps(load({ ladder: { stepCount: 3, step: 0.5, direction: 'around' } }))
const [low, main, high] = [nth(ladder, 0), nth(ladder, 1), nth(ladder, 2)] as const

/** Applies the changes in order to a stored record, as the store does. */
const apply = (...changes: ((stored: unknown) => SessionRecord)[]) =>
  changes.reduce<SessionRecord | undefined>((stored, change) => change(stored), undefined)

it('builds the session from the first shot and keeps strings apart by step', () => {
  const s = defined(
    apply(
      addShot(context, main, 850),
      addShot(context, high, 870),
      addShot(context, main, 852),
      addShot(context, low, 830),
    ),
  )
  expect(userRecord.safeParse(s).success).toBe(true)
  expect(s.id).toBe(context.id)
  expect(s.data.date).toBe('2026-10-27')
  expect(s.data.strings).toHaveLength(3)
  const [first, second, third] = [0, 1, 2].map((i) => nth(s.data.strings, i)) as [
    SessionString,
    SessionString,
    SessionString,
  ]
  expect(first).toMatchObject({
    load: loadRef,
    label: 'Main charge',
    variation: { kind: 'charge', value: { value: 42.5 } },
  })
  expect(first.shots.map((x) => x.velocity.value)).toEqual([850, 852])
  expect(second.variation).toEqual({ kind: 'charge', value: { value: 43 } })
  expect(third.label).toBe('Step −1')
})

it('derives one valid session id per load and day', () => {
  const id = rangeSessionId(loadRef, '2026-10-27')
  expect(userId.safeParse(id).success).toBe(true)
  expect(rangeSessionId(loadRef, '2026-10-27')).toBe(id)
  expect(rangeSessionId(loadRef, '2026-10-28')).not.toBe(id)
  expect(rangeSessionId('user:other', '2026-10-27')).not.toBe(id)
})

it('excludes a shot from the statistics and keeps it in the data, and takes the mark off', () => {
  const entered = defined(
    apply(addShot(context, main, 850), addShot(context, main, 852), addShot(context, main, 900)),
  )
  const string = () => nth(entered.data.strings, 0)
  expect(rangeStats(string())).toMatchObject({ count: 3, excluded: 0, max: 900 })
  const out = setExcluded(context, main, 2, true)(entered)
  const kept = nth(out.data.strings, 0)
  expect(kept.shots).toHaveLength(3)
  expect(nth(kept.shots, 2).excluded).toBe(rangeExcluded)
  expect(rangeStats(kept)).toMatchObject({ count: 2, excluded: 1, max: 852, mean: 851 })
  const back = nth(setExcluded(context, main, 2, false)(out).data.strings, 0)
  expect(nth(back.shots, 2)).toEqual({ velocity: { value: 900 } })
  expect(() => setExcluded(context, main, 3, true)(entered)).toThrow('No such shot')
})

it('sets the weather and the note of a string that has shots, and removes a cleared field', () => {
  const entered = defined(apply(addShot(context, main, 850)))
  const typed = setNotes(context, main, {
    conditions: { airTemperature: { value: 12 }, windSpeed: { value: 3 } },
    note: 'light rain',
  })(entered)
  expect(userRecord.safeParse(typed).success).toBe(true)
  expect(nth(typed.data.strings, 0)).toMatchObject({
    conditions: { airTemperature: { value: 12 }, windSpeed: { value: 3 } },
    note: 'light rain',
  })
  const cleared = nth(setNotes(context, main, { conditions: {}, note: '' })(typed).data.strings, 0)
  expect(cleared).not.toHaveProperty('conditions')
  expect(cleared).not.toHaveProperty('note')
  expect(() => setNotes(context, main, { conditions: {}, note: 'x' })(entered)).not.toThrow()
  expect(() => setNotes(context, low, { conditions: {}, note: 'x' })(entered)).toThrow(
    'no shot yet',
  )
  // the weather typed before the first shot goes with it
  const first = defined(
    apply(addShot(context, high, 870, { conditions: { windSpeed: { value: 2 } }, note: 'n' })),
  )
  expect(nth(first.data.strings, 0)).toMatchObject({
    conditions: { windSpeed: { value: 2 } },
    note: 'n',
  })
})

it('refuses a change that would store a record the schema rejects', () => {
  const entered = defined(apply(addShot(context, main, 850)))
  expect(() =>
    setNotes(context, main, { conditions: {}, note: 'x'.repeat(2001) })(entered),
  ).toThrow()
  expect(() => addShot(context, main, 850, { note: 'x'.repeat(2001) })(undefined)).toThrow()
})

it('leaves a stored record that is not a session of the range alone', () => {
  const bullet = { kind: 'bullet', id: context.id, name: 'x', saved: '', data: {} }
  expect(() => addShot(context, main, 850)(bullet)).toThrow('not a valid session')
})

it('applies two changes to the stored record in one transaction, so neither is lost', async () => {
  // two tabs enter a shot at the same time: both are kept
  const [a, b] = await Promise.all([
    updateRecord(context.id, addShot(context, main, 850)),
    updateRecord(context.id, addShot(context, main, 851)),
  ])
  expect(a).toBeDefined()
  expect(b).toBeDefined()
  const stored = session(await storedRecord(context.id))
  expect(nth(stored.data.strings, 0).shots.map((x) => x.velocity.value)).toEqual([850, 851])
  // a change that throws leaves the record as it was
  await expect(updateRecord(context.id, setExcluded(context, main, 9, true))).rejects.toThrow()
  const same = session(await storedRecord(context.id))
  expect(nth(same.data.strings, 0).shots).toHaveLength(2)
})

it('reads a velocity in the unit shown and refuses what is not one', () => {
  const fps = (x: number) => x * 0.3048
  expect(parseVelocity('2800', fps)).toEqual({ velocity: 2800 * 0.3048 })
  expect(parseVelocity(' 850,5 ', (x) => x)).toEqual({ velocity: 850.5 })
  for (const bad of ['', ' ', '0', '-3', 'abc', '1e999'])
    expect(parseVelocity(bad, (x) => x)).toHaveProperty('error')
  expect(parseVelocity('12000', fps)).toHaveProperty('error')
})

it('saves a load with the sessions the stored copy gained and not those removed here', () => {
  const rec = (sessions: string[] | undefined) =>
    ({
      kind: 'load',
      id: 'l',
      name: 'L',
      saved: '',
      data: { origin: 'user', sessions },
    }) as UserRecord
  const merged = withStoredSessions(rec(['a']), rec(['a', 'b']), ['a'])
  expect(merged.kind === 'load' && merged.data.sessions).toEqual(['a', 'b'])
  // the snapshot of the added session comes with it, a snapshot of a known session does not
  const withSnapshots = (r: UserRecord, snapshots: SessionSnapshot[]) =>
    r.kind === 'load' ? ({ ...r, data: { ...r.data, snapshots } } as UserRecord) : r
  const both = withStoredSessions(
    withSnapshots(rec(['a']), [{ session: 'a', powderLot: 'own' }]),
    withSnapshots(rec(['a', 'b']), [
      { session: 'a', powderLot: 'stored' },
      { session: 'b', powderLot: 'range' },
    ]),
    ['a'],
  )
  expect(both.kind === 'load' && both.data.snapshots).toEqual([
    { session: 'a', powderLot: 'own' },
    { session: 'b', powderLot: 'range' },
  ])
  const same = rec(['b'])
  expect(withStoredSessions(same, rec(['a', 'b']), ['a', 'b'])).toBe(same)
  expect(withStoredSessions(same, undefined, [])).toBe(same)
  const bullet = { kind: 'bullet' } as UserRecord
  expect(withStoredSessions(bullet, rec(['x']), [])).toBe(bullet)
})

it('keeps the sessions another tab added and the removal made here', () => {
  expect(mergeSessionRefs(['a', 'b'], ['a'], ['a'])).toEqual(['a', 'b'])
  // removed here after opening: not brought back
  expect(mergeSessionRefs(['a', 'b'], ['a', 'b'], ['b'])).toEqual(['b'])
  expect(mergeSessionRefs(['a'], ['a'], ['a', 'c'])).toEqual(['a', 'c'])
  expect(mergeSessionRefs([], [], [])).toEqual([])
})

const units = presetUnits('us')

it('reads the weather typed in the units shown and writes it in the stored ones', () => {
  const typed = parseWeather({ temperature: '50', pressure: '29,92', wind: '10' }, units)
  if ('error' in typed) throw new Error(typed.error)
  expect(typed.conditions.airTemperature?.value).toBeCloseTo(10, 6)
  expect(typed.conditions.stationPressure?.value).toBeCloseTo(1.01325, 3)
  expect(typed.conditions.windSpeed?.value).toBeCloseTo(4.4704, 6)
  expect(parseWeather({ temperature: '', pressure: ' ', wind: '' }, units)).toEqual({
    conditions: {},
  })
  expect(parseWeather({ temperature: 'x', pressure: '', wind: '' }, units)).toEqual({
    error: 'Enter the temperature as a number.',
  })
  expect(parseWeather({ temperature: '', pressure: '0', wind: '' }, units)).toHaveProperty('error')
  expect(parseWeather({ temperature: '', pressure: '', wind: '-1' }, units)).toHaveProperty('error')
})

it('writes the weather of a string as one line in the units shown', () => {
  expect(conditionsText(undefined, units)).toBe('')
  expect(
    conditionsText({ airTemperature: { value: 10 }, windSpeed: { value: 4.4704 } }, units),
  ).toBe(
    `air ${withUnit('temperature', units, 283.15)}, wind ${withUnit('windSpeed', units, 4.4704)}`,
  )
})

it('names the session in the load with a snapshot of the load as it is, once', () => {
  const record = {
    kind: 'load',
    id: '33333333-3333-4333-8333-333333333333',
    name: 'L',
    saved: '',
    data: {
      origin: 'user',
      powderLot: ' P1 ',
      primer: { lot: 'R1' },
      seating: { by: 'overallLength', value: { value: 70 } },
      sessions: ['user:11111111-1111-4111-8111-111111111111'],
      snapshots: [{ session: 'user:11111111-1111-4111-8111-111111111111', powderLot: 'P0' }],
    },
  } as UserRecord
  const now = new Date('2026-10-27T10:00:00Z')
  const out = withSession(record, 'user:22222222-2222-4222-8222-222222222222', 120, now)
  expect(out?.kind === 'load' && out.data.sessions).toEqual([
    'user:11111111-1111-4111-8111-111111111111',
    'user:22222222-2222-4222-8222-222222222222',
  ])
  expect(out?.kind === 'load' && out.data.snapshots).toEqual([
    { session: 'user:11111111-1111-4111-8111-111111111111', powderLot: 'P0' },
    {
      session: 'user:22222222-2222-4222-8222-222222222222',
      powderLot: 'P1',
      primerLot: 'R1',
      seating: { by: 'overallLength', value: { value: 70 } },
      roundCount: 120,
    },
  ])
  expect(out?.saved).toBe(now.toISOString())
  if (!out) throw new Error('expected a record')
  expect(withSession(out, 'user:22222222-2222-4222-8222-222222222222', 120, now)).toBeUndefined()
  const full = {
    ...record,
    data: {
      origin: 'user',
      sessions: Array.from(
        { length: 50 },
        (_, i) => `user:${String(i).padStart(8, '0')}-4444-4444-8444-444444444444`,
      ),
    },
  } as UserRecord
  expect(() =>
    withSession(full, 'user:22222222-2222-4222-8222-222222222222', undefined, now),
  ).toThrow('50 sessions')
  expect(() =>
    withSession(
      { kind: 'bullet' } as UserRecord,
      'user:22222222-2222-4222-8222-222222222222',
      undefined,
      now,
    ),
  ).toThrow('not a valid load')
})
