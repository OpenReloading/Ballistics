import { targetFaceFigure } from '@open-reloading/drawing/target'
import { type TargetFaceDesign, targetFace, type UserRecord } from '@open-reloading/schema'
import { describe, expect, it } from 'vitest'
import { fieldValueFromText } from '../src/lib/field-spec.ts'
import { historyOf } from '../src/lib/history.ts'
import {
  type Design,
  faceOf,
  fileData,
  fromFile,
  liveRows,
  newDesign,
  reduce,
  shapeOf,
} from '../src/lib/target-designer.ts'
import { presetUnits } from '../src/lib/units.ts'
import { parseUserDataFile, userDataText } from '../src/lib/user-data.ts'
import { userOrganization } from '../src/lib/user-faces.ts'

const metric = presetUnits('metric-grams')
const us = presetUnits('us')

/** A pistol-sized face with oval-free rings, a coloured black zone, an inner ten and two events. */
const club: TargetFaceDesign = {
  rings: [
    { value: 1, diameter: 150, fill: 'white', line: 'black' },
    { value: 2, diameter: 120, fill: 'white' },
    { value: 3, diameter: 90, fill: 'black' },
    { value: 4, diameter: 60, fill: 'black' },
  ],
  innerTen: { diameter: 10.5, rule: 'cover' },
  blackDiameter: 90,
  decimal: true,
  events: [
    { name: '25 m precision', distance: 25_000, gauge: 5.6 },
    { name: '50 m', distance: 50_000 },
  ],
}

const draft = (data = club, system = metric) => fromFile(data, 'Club face', system)

describe('faceOf', () => {
  it('builds a face that the target face schema accepts', () => {
    const built = faceOf(draft(), 'user-a1')
    if (!('face' in built)) throw new Error(JSON.stringify(built.problems))
    expect(targetFace.safeParse(built.face).success).toBe(true)
    expect(built.face).toMatchObject({
      id: 'user-a1',
      name: 'Club face',
      organization: userOrganization,
      blackDiameter: { value: 90 },
      decimal: true,
    })
    expect(built.face.rings.map((r) => [r.value, r.diameter.value])).toEqual([
      [1, 150],
      [2, 120],
      [3, 90],
      [4, 60],
    ])
    expect(built.face.events[0]).toMatchObject({
      distance: { value: 25_000 },
      gauge: { value: 5.6 },
    })
  })

  it('builds the same face from numbers entered in inches', () => {
    const inches = fromFile(club, 'Club face', us)
    expect(faceOf(inches, 'user-a1')).toEqual(faceOf(draft(), 'user-a1'))
  })

  it('names the field of each problem and ignores rows with nothing entered', () => {
    const d = draft({
      ...club,
      rings: [...club.rings.slice(0, 2), { value: 3, diameter: 130 }, {}],
    })
    const built = faceOf(d, 'user-a1')
    if (!('problems' in built)) throw new Error('built a face')
    const third = liveRows(d)[2].id
    expect(built.problems).toContainEqual({
      key: `ring.${third}.diameter`,
      message: 'must be below the ring outside it',
    })
    expect(liveRows(d)).toHaveLength(3)
  })

  it('asks for the number a started row lacks and for the black area', () => {
    const d = draft({ ...club, rings: [{ value: 1 }, { value: 2, diameter: 50 }] })
    const built = faceOf({ ...d, fields: { ...d.fields } }, 'user-a1')
    if (!('problems' in built)) throw new Error('built a face')
    expect(built.problems).toContainEqual({
      key: `ring.${d.rows[0].id}.diameter`,
      message: 'Required.',
    })
  })

  it('reports a rule across rings as a message about the rings', () => {
    const d = draft({ ...club, rings: club.rings.map((r, i) => (i ? { ...r, height: 50 } : r)) })
    const built = faceOf(d, 'user-a1')
    if (!('problems' in built)) throw new Error('built a face')
    expect(built.problems.some((p) => !p.key && p.message.startsWith('Rings: '))).toBe(true)
  })
})

describe('the draft file', () => {
  const record = (d: Design): UserRecord => ({
    kind: 'targetFaceDesign',
    id: 'a1',
    name: d.name,
    saved: '2026-10-24T10:00:00.000Z',
    data: fileData(d),
  })

  it('gives the same draft after export and import', () => {
    const d = draft()
    const parsed = parseUserDataFile(userDataText([record(d)]))
    if (!parsed.ok) throw new Error(parsed.reason)
    const [back] = parsed.records
    if (back.kind !== 'targetFaceDesign') throw new Error(back.kind)
    expect(back.data).toEqual(club)
    expect(back.name).toBe('Club face')
    expect(fileData(fromFile(back.data, back.name, us))).toEqual(club)
  })

  it('keeps a draft that is no face yet', () => {
    const data = fileData(draft({ rings: [{ diameter: 40 }, {}], events: [{ name: '' }] }))
    expect(data).toEqual({ rings: [{ diameter: 40 }], events: [] })
    expect(parseUserDataFile(userDataText([record(draft(data))])).ok).toBe(true)
  })

  it('leaves out a number that is not positive', () => {
    const d = draft()
    const key = `ring.${d.rows[0].id}.diameter`
    const bad = { ...d, fields: { ...d.fields, [key]: fieldValueFromText('length', metric, '-3') } }
    expect(fileData(bad).rings[0]).not.toHaveProperty('diameter')
  })

  it('stores a diameter typed in mm or in inches as millimetres', () => {
    const d = draft()
    const key = `ring.${d.rows[0].id}.diameter`
    const typed = (system: typeof metric, text: string) =>
      fileData({ ...d, fields: { ...d.fields, [key]: fieldValueFromText('length', system, text) } })
    expect(typed(metric, '150').rings[0].diameter).toBe(150)
    expect(typed(us, '2').rings[0].diameter).toBe(50.8)
  })

  it('leaves out a ring value that is not a whole number, as the schema requires', () => {
    const d = draft()
    const key = `ring.${d.rows[0].id}.value`
    const set = (text: string) => ({
      ...d,
      fields: { ...d.fields, [key]: fieldValueFromText('ratio', metric, text) },
    })
    expect(fileData(set('1.5')).rings[0]).not.toHaveProperty('value')
    expect(fileData(set('7')).rings[0].value).toBe(7)
  })
})

describe('the drawing', () => {
  it('shows the rings with the values and diameters entered, in either unit', () => {
    for (const system of [metric, us]) {
      const shape = shapeOf(fromFile(club, 'Club face', system))
      const { lines } = targetFaceFigure(shape ?? never())
      const rings = lines.filter((l) => l.ring)
      expect(rings.map((l) => l.ring)).toEqual(club.rings.map((r) => r.value))
      rings.forEach((l, i) => {
        expect(l.rx * 2).toBeCloseTo(club.rings[i].diameter ?? 0, 9)
        expect(l.ry).toBe(l.rx)
      })
    }
  })

  it('draws the rings entered so far, without a black area', () => {
    const d = draft({ rings: [{ diameter: 80 }, { diameter: 40 }], events: [] })
    expect(targetFaceFigure(shapeOf(d) ?? never()).lines.map((l) => l.rx)).toEqual([40, 20])
  })

  it('draws nothing before a diameter is entered', () => {
    expect(shapeOf(newDesign())).toBeUndefined()
  })
})

describe('reduce', () => {
  it('adds a ring one value above the last and removes a ring with its numbers', () => {
    const d = draft()
    const id = 'added'
    const added = reduce(historyOf(d), { type: 'addRing', id }).present
    expect(added.rows.at(-1)?.id).toBe(id)
    expect(added.fields[`ring.${id}.value`]?.si).toBe(5)
    const removed = reduce(historyOf(added), { type: 'removeRing', id }).present
    expect(Object.keys(removed.fields).some((k) => k.includes(id))).toBe(false)
  })

  it('gives back every size to the hundredth of a millimetre, in either unit', () => {
    // 0.05 mm steps, as entered in mm and as the same size entered in inches
    for (let i = 1; i <= 6000; i++) {
      const mm = Number((i * 0.05).toFixed(2))
      for (const system of [metric, us]) {
        const data = { rings: [{ value: 1, diameter: mm }], events: [] }
        expect(fileData(fromFile(data, 'x', system)).rings[0].diameter).toBe(mm)
      }
    }
  })

  it('keeps the entered values when the units change', () => {
    const d = draft()
    const switched = reduce(historyOf(d), { type: 'units', system: us }).present
    expect(fileData(switched)).toEqual(club)
    expect(switched.fields[`ring.${d.rows[0].id}.diameter`].text).not.toBe('150')
  })
})

function never(): never {
  throw new Error('unreachable')
}
