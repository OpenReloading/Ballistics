import { dispersionEllipse, predictionEllipse, subtendedAngle } from '@open-reloading/core'
import type { ShotGroup, TargetSheet } from '@open-reloading/schema'
import { describe, expect, it } from 'vitest'
import de from '../src/i18n/de.json'
import { english, translator } from '../src/i18n/translate.ts'
import { readouts } from '../src/lib/group-readouts.ts'
import { type LabelBox, type LabelScene, placeLabel } from '../src/lib/label-placement.ts'
import {
  axisEnds,
  clicksToAim,
  coverages,
  ellipsePoints,
  extremePairIndices,
  frameOf,
  ladderExtremeSpreads,
  newGroup,
  rebase,
  screenNudge,
  shotExtentCorners,
  targetToView,
  turnSheet,
  viewToTarget,
  withoutRegions,
} from '../src/lib/target-editor.ts'
import { type Point, turnPoint } from '../src/lib/target-geometry.ts'
import { groupStatisticsOf } from '../src/lib/target-groups.ts'
import {
  keptCopy,
  keptNote,
  mergeWaitingCopies,
  withoutWaitingCopy,
} from '../src/lib/waiting-copies.ts'
import { defined, missing } from './defined.ts'

const group: ShotGroup = {
  id: 'g1',
  name: 'Group 1',
  colour: '#d9480f',
  distance: 100,
  aim: { x: 0, y: 0 },
  shots: [
    { x: 0.01, y: 0.002, placement: 'placed' },
    { x: 0.014, y: -0.004, placement: 'placed' },
    { x: 0.006, y: -0.001, placement: 'placed' },
    { x: 0.05, y: 0.04, placement: 'placed', excluded: true },
  ],
}

const sheet: TargetSheet = {
  photo: 'p1',
  references: [{ kind: 'line', a: { x: 100, y: 500 }, b: { x: 1100, y: 500 }, length: 0.1 }],
  targetRotation: 0,
  targetOrigin: { x: 600, y: 500 },
  groups: [group],
}

it('drops the detection regions of the old photo and keeps the shots and other choices', () => {
  const region = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 10 },
  ]
  const g = { ...group, detection: { region, minContrast: 0.2 } }
  const out = withoutRegions({ ...sheet, groups: [g, group] })
  expect(out.groups[0]).toEqual({ ...group, detection: { minContrast: 0.2 } })
  expect(out.groups[1]).toBe(group)
})

describe('frameOf', () => {
  it('maps a drawn target as mm with y down, and waits for a reference with a photo', () => {
    const drawn = frameOf({ references: [], targetRotation: 0, groups: [] })
    expect(drawn && targetToView(drawn, { x: 0.012, y: 0.003 })).toEqual({ x: 12, y: -3 })
    expect(frameOf({ ...sheet, references: [] })).toBeUndefined()
  })
})

describe('rebase', () => {
  it('keeps every shot and the point of aim on its photo point after a rotation', () => {
    const turned = rebase(sheet, { ...sheet, targetRotation: 0.3 })
    const [a, b] = [frameOf(sheet), frameOf(turned)]
    if (!a || !b) throw new Error('no frame')
    defined(turned.groups[0]).shots.forEach((s, i) => {
      const p = targetToView(a, defined(group.shots[i]))
      const q = targetToView(b, s)
      expect(q.x).toBeCloseTo(p.x, 9)
      expect(q.y).toBeCloseTo(p.y, 9)
    })
    expect(defined(defined(turned.groups[0]).shots[3]).excluded).toBe(true)
    const aim = targetToView(b, defined(turned.groups[0]).aim ?? { x: Number.NaN, y: 0 })
    expect(aim.x).toBeCloseTo(600, 9)
  })

  it('keeps the ring marks of a face on their photo points after a new scale', () => {
    const marks = [
      { ring: 8, x: 0.01, y: 0 },
      { ring: 8, x: -0.01, y: 0 },
      { ring: 6, x: 0, y: 0.02 },
      { ring: 6, x: 0, y: -0.02 },
    ]
    const withFace = { ...sheet, groups: [{ ...group, face: { id: 'f', marks } }] }
    const line = { ...sheet.references[0], length: 0.11 } as (typeof sheet.references)[0]
    const next = rebase(withFace, { ...withFace, references: [line] })
    const [a, b] = [frameOf(withFace), frameOf(next)]
    if (!a || !b) throw new Error('no frame')
    defined(next.groups[0]).face?.marks?.forEach((m, i) => {
      expect(m.ring).toBe(defined(marks[i]).ring)
      const p = targetToView(a, defined(marks[i]))
      const q = targetToView(b, m)
      expect(q.x).toBeCloseTo(p.x, 9)
      expect(q.y).toBeCloseTo(p.y, 9)
    })
    expect(defined(defined(next.groups[0]).face?.marks?.[0]).x).toBeCloseTo(0.011, 12)
  })

  it('leaves the shots as they are when one side has no calibration', () => {
    const next = { ...sheet, references: [] }
    expect(rebase(sheet, next)).toBe(next)
  })
})

describe('turnSheet', () => {
  const size = { width: 1200, height: 1000 }
  const withRegion: TargetSheet = {
    ...sheet,
    groups: [
      {
        ...group,
        detection: {
          region: [
            { x: 600, y: 100 },
            { x: 700, y: 100 },
            { x: 700, y: 200 },
          ],
        },
      },
    ],
  }

  it('turns the photo by 90 degrees: shots stay on their holes, the axes on the screen', () => {
    const turned = turnSheet(withRegion, size, Math.PI / 2)
    expect(turned.photoRotation).toBeCloseTo(Math.PI / 2, 12)
    const [a, b] = [frameOf(withRegion), frameOf(turned)]
    if (!a || !b) throw new Error('no frame')
    const c = { x: 600, y: 500 }
    defined(turned.groups[0]).shots.forEach((s, i) => {
      const p = turnPoint(targetToView(a, defined(group.shots[i])), c, Math.PI / 2)
      const q = targetToView(b, s)
      expect(q.x).toBeCloseTo(p.x, 9)
      expect(q.y).toBeCloseTo(p.y, 9)
    })
    // the point (100, 0) right of the middle goes up on screen: (600, 400)
    expect(turned.references[0]).toMatchObject({ kind: 'line' })
    const r = defined(turned.groups[0]).detection?.region?.[0]
    expect(r?.x).toBeCloseTo(200, 9)
    expect(r?.y).toBeCloseTo(500, 9)
    // a shot 10 mm right of the origin is 10 mm up after a quarter turn counter-clockwise
    expect(defined(defined(turned.groups[0]).shots[0]).x).toBeCloseTo(-0.002, 9)
    expect(defined(defined(turned.groups[0]).shots[0]).y).toBeCloseTo(0.01, 9)
    expect(defined(defined(turned.groups[0]).shots[3]).excluded).toBe(true)
  })

  it('turned back, the sheet is as before; an angle is kept in (-pi, pi]', () => {
    const back = turnSheet(turnSheet(withRegion, size, 0.2), size, 0)
    expect(back.photoRotation).toBeUndefined()
    defined(back.groups[0]).shots.forEach((s, i) => {
      expect(s.x).toBeCloseTo(defined(group.shots[i]).x, 9)
      expect(s.y).toBeCloseTo(defined(group.shots[i]).y, 9)
    })
    expect(turnSheet(sheet, size, (3 * Math.PI) / 2).photoRotation).toBeCloseTo(-Math.PI / 2, 12)
  })
})

describe('a photo with a 100 mm line, turned by 90 degrees, then a rectangle', () => {
  // a 1600 x 1200 px photo: a 100 mm bar from (300, 1100) to (1300, 1100), a 100 mm square from
  // (300, 100) to (1300, 1100), the origin at the photo centre
  const line = {
    kind: 'line' as const,
    a: { x: 300, y: 1100 },
    b: { x: 1300, y: 1100 },
    length: 0.1,
  }
  const square = {
    kind: 'rectangle' as const,
    corners: [
      { x: 300, y: 100 },
      { x: 1300, y: 100 },
      { x: 1300, y: 1100 },
      { x: 300, y: 1100 },
    ] as [Point, Point, Point, Point],
    width: 0.1,
    height: 0.1,
  }
  const lined: TargetSheet = {
    photo: 'p1',
    references: [line],
    targetRotation: 0,
    targetOrigin: { x: 800, y: 600 },
    groups: [{ ...group, shots: [] }],
  }
  const shotOf = (s: TargetSheet) => defined(s.groups[0]).shots[0]
  const hole = (s: TargetSheet) => {
    const f = frameOf(s)
    if (!f) throw new Error('no frame')
    return targetToView(f, defined(shotOf(s)))
  }

  it('keeps the shot on its hole: (30, 30) mm, then (30, -30) mm; the references disagree by 0 %', () => {
    const f = frameOf(lined)
    if (!f) throw new Error('no frame')
    const q = viewToTarget(f, { x: 1100, y: 300 })
    expect(q.x).toBeCloseTo(0.03, 12)
    expect(q.y).toBeCloseTo(0.03, 12)
    const placed: TargetSheet = {
      ...lined,
      groups: [{ ...defined(lined.groups[0]), shots: [{ ...q, placement: 'placed' }] }],
    }
    // the target axes turn by 90 degrees counter-clockwise on the photo
    const turned = rebase(placed, { ...placed, targetRotation: Math.PI / 2 })
    expect(defined(shotOf(turned)).x).toBeCloseTo(0.03, 12)
    expect(defined(shotOf(turned)).y).toBeCloseTo(-0.03, 12)
    expect(hole(turned).x).toBeCloseTo(1100, 6)
    expect(hole(turned).y).toBeCloseTo(300, 6)
    const both = rebase(turned, { ...turned, references: [line, square] })
    expect(defined(shotOf(both)).x).toBeCloseTo(0.03, 9)
    expect(defined(shotOf(both)).y).toBeCloseTo(-0.03, 9)
    expect(hole(both).x).toBeCloseTo(1100, 6)
    expect(hole(both).y).toBeCloseTo(300, 6)
    expect(frameOf(both)?.calibration?.spread).toBeCloseTo(0, 9)
  })
})

describe('overlays', () => {
  it('finds the extreme pair among included shots only', () => {
    expect(extremePairIndices(group.shots)).toEqual([1, 2])
    expect(extremePairIndices(group.shots.slice(0, 1))).toBeUndefined()
  })

  it('boxes the included shots', () => {
    expect(shotExtentCorners(group.shots)?.[2]).toEqual({ x: 0.014, y: 0.002 })
  })

  it('puts ellipse points at the covariance semi-axes and the axis through the centre', () => {
    const s = groupStatisticsOf(group)
    const pts = ellipsePoints(s, dispersionEllipse(s, 0.95), 4)
    const c = s.centre
    if (!pts || !c) throw new Error('no ellipse')
    expect(pts).toHaveLength(4)
    const r0 = Math.hypot(defined(pts[0]).x - c.x, defined(pts[0]).y - c.y)
    const r1 = Math.hypot(defined(pts[1]).x - c.x, defined(pts[1]).y - c.y)
    expect(r0).toBeGreaterThan(r1)
    const ends = axisEnds(s)
    expect(ends && (ends[0].x + ends[1].x) / 2).toBeCloseTo(c.x, 12)
    expect(ellipsePoints(s, undefined)).toBeUndefined()
  })

  const overlap = (a: LabelBox, b: LabelBox) =>
    a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h

  /** The label is farther than `r` from every shot, overlaps no other box, and lies inside the view. */
  const expectClear = (b: LabelBox, shots: Point[], boxes: LabelScene['boxes'], r: number) => {
    for (const p of shots) {
      const dx = Math.max(b.x - p.x, 0, p.x - b.x - b.w)
      const dy = Math.max(b.y - p.y, 0, p.y - b.y - b.h)
      expect(Math.hypot(dx, dy)).toBeGreaterThan(r)
    }
    for (const o of boxes) if (o !== b) expect(overlap(b, o)).toBe(false)
    // inside the view
    expect(b.x).toBeGreaterThanOrEqual(-110)
    expect(b.y + b.h).toBeLessThanOrEqual(110)
  }

  it('places the labels clear of every shot, number, line and other label', () => {
    // a drawn target (view mm, y down), 1 px = 0.35 mm
    const g: ShotGroup = {
      ...group,
      aim: undefined,
      shots: [
        [4, 8],
        [10, 2],
        [0, -1],
        [13, 12],
        [30, 30],
      ].map(([x = missing(), y = missing()], i) => ({
        x: x / 1e3,
        y: y / 1e3,
        placement: 'placed',
        excluded: i === 4,
      })),
    }
    const frame = frameOf({ ...sheet, photo: undefined, groups: [g] })
    if (!frame) throw new Error('no frame')
    const v = (q: Point) => targetToView(frame, q)
    const k = 0.35
    const [fontSize, r] = [11 * k, 6 * k]
    const shots = g.shots.map(v)
    const scene: LabelScene = {
      circles: shots.map((p) => ({ ...p, r })),
      segments: [],
      boxes: shots.map((p, i) => ({
        x: p.x + r + 2 * k,
        y: p.y - r - fontSize,
        w: 0.6 * fontSize * String(i + 1).length,
        h: fontSize,
      })),
      view: { x: -110, y: -110, w: 220, h: 220 },
      fontSize,
      gap: 3 * k,
    }
    const s = groupStatisticsOf(g)
    if (!s.centre || !s.excludedOffset) throw new Error('no centre')
    const c = v(s.centre)
    const outlines = [predictionEllipse, dispersionEllipse].flatMap((at) =>
      coverages.map((p) => (ellipsePoints(s, at(s, p)) ?? []).map(v)),
    )
    const ends = axisEnds(s)?.map(v) ?? []
    const ex = v({ x: s.centre.x + s.excludedOffset.x, y: s.centre.y + s.excludedOffset.y })
    for (const o of outlines)
      for (const [i, p] of o.entries()) scene.segments.push([p, defined(o[(i + 1) % o.length])])
    scene.segments.push([defined(ends[0]), defined(ends[1])], [c, ex])
    const extremes = (pts: Point[]) => [
      pts.reduce((a, b) => (b.y < a.y ? b : a)),
      pts.reduce((a, b) => (b.x > a.x ? b : a)),
    ]
    // in the canvas's order: labels tied to one point first
    const placed: LabelBox[] = [
      placeLabel(scene, 'excluded shots', [ex], c),
      placeLabel(scene, 'major axis', [defined(ends[1]), defined(ends[0])], c),
      ...outlines.map((o) => placeLabel(scene, '95 % fired', extremes(o), c)),
    ]
    for (const b of placed) expectClear(b, shots, scene.boxes, r)
    // the excluded label sits next to the excluded shot, not on it
    const e = defined(placed[0])
    const near = Math.hypot(
      Math.max(e.x - ex.x, 0, ex.x - e.x - e.w),
      Math.max(e.y - ex.y, 0, ex.y - e.y - e.h),
    )
    expect(near).toBeGreaterThan(r)
    expect(near).toBeLessThan(3 * e.h)
  })
})

describe('readouts', () => {
  it('lists the sizes with their angle, the SD intervals and the CEP for any axes', () => {
    const st = groupStatisticsOf(group)
    const r = readouts(st, 100)
    expect(r.map((x) => x.key)).toEqual([
      'extremeSpread',
      'width',
      'height',
      'meanRadius',
      'minPairDistance',
      'meanPairDistance',
      'standardDeviationX',
      'standardDeviationY',
      'radialStandardDeviation',
      'cepElliptical',
    ])
    const es = defined(r[0])
    expect(es.angle).toBeCloseTo(2 * Math.atan(es.value / 200), 15)
    expect(es.interval).toBeUndefined()
    expect(defined(r[4]).interval).toBeUndefined()
    expect(defined(r[5]).interval).toBeUndefined()
    expect(defined(r[6]).interval?.degreesOfFreedom).toBe(2)
    expect(defined(r[6]).interval?.circular).toBe(false)
    expect(defined(r[8]).interval?.circular).toBe(true)
    const cep = defined(r[9])
    expect(cep.value).toBe(st.cepElliptical)
    // the circular estimate and its interval belong to the hover detail only
    expect(cep.interval).toBeUndefined()
    expect(cep.circular?.value).toBe(st.cep)
    expect(cep.circular?.interval?.degreesOfFreedom).toBe(4)
    expect(cep.circular?.interval?.lower).toBe(st.confidence?.cep.lower)
  })

  it('leaves out every size with one shot', () => {
    expect(readouts(groupStatisticsOf({ ...group, shots: group.shots.slice(0, 1) }), 100)).toEqual(
      [],
    )
  })
})

describe('clicksToAim', () => {
  it('dials against the offset: a group high and right needs down and left', () => {
    // 0.1 mrad clicks, 20 mm right and 10 mm high at 100 m: 0.2 and 0.1 mrad
    const c = clicksToAim({ dx: 0.02, dy: 0.01, distance: 0, compass: 'NE' }, 100, 1e-4)
    expect(c).toEqual({
      horizontal: { clicks: 2, direction: 'left' },
      vertical: { clicks: 1, direction: 'down' },
    })
    const low = clicksToAim({ dx: -0.01, dy: -0.005, distance: 0, compass: 'SW' }, 100, 1e-4)
    expect(low.horizontal.direction).toBe('right')
    expect(low.vertical.direction).toBe('up')
  })
})

describe('screenNudge', () => {
  it('moves a shot along the screen, whatever the rotation of the target axes', () => {
    const f = frameOf({ ...sheet, targetRotation: Math.PI / 2 })
    if (!f) throw new Error('no frame')
    const q = { x: 0.01, y: 0.02 }
    const p = targetToView(f, q)
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] satisfies [number, number][]) {
      const n = screenNudge(f, q, dx, dy, 1e-4)
      const m = targetToView(f, n)
      // 0.1 mm at 10 px per mm: 1 px on the photo in the key's direction
      expect(m.x - p.x).toBeCloseTo(dx, 9)
      expect(m.y - p.y).toBeCloseTo(dy, 9)
      expect(Math.hypot(n.x - q.x, n.y - q.y)).toBeCloseTo(1e-4, 12)
    }
  })

  it('on a drawn target moves right along x and up along y', () => {
    const f = frameOf({ references: [], targetRotation: 0, groups: [] })
    if (!f) throw new Error('no frame')
    const right = screenNudge(f, { x: 0, y: 0 }, 1, 0, 1e-4)
    const up = screenNudge(f, { x: 0, y: 0 }, 0, -1, 1e-3)
    expect(right.x).toBeCloseTo(1e-4, 15)
    expect(right.y).toBeCloseTo(0, 15)
    expect(up.x).toBeCloseTo(0, 15)
    expect(up.y).toBeCloseTo(1e-3, 15)
  })
})

describe('ladderSpreads', () => {
  const pair = (id: string, step: number, distance: number, es: number): ShotGroup => ({
    id,
    name: id,
    colour: '#000000',
    distance,
    ladderStep: step,
    shots: [
      { x: 0, y: 0, placement: 'placed' },
      { x: es, y: 0, placement: 'placed' },
    ],
  })

  it('averages the extreme spread of groups at different distances as an angle, without a length', () => {
    const rows = ladderExtremeSpreads(
      [pair('a', 0, 100, 0.02), pair('b', 0, 200, 0.02), pair('c', 1, 100, 0.04)],
      [0.003, 0.0031],
    )
    expect(rows.map((r) => [r.step, r.groups])).toEqual([
      [0, 2],
      [1, 1],
    ])
    expect(defined(rows[0]).angle).toBeCloseTo(
      (subtendedAngle(0.02, 100) + subtendedAngle(0.02, 200)) / 2,
      15,
    )
    expect(defined(rows[1]).angle).toBeCloseTo(subtendedAngle(0.04, 100), 15)
    expect(rows.every((r) => r.length === undefined)).toBe(true)
  })

  it('gives the mean length too when every group is at one distance; leaves out steps without a size', () => {
    const rows = ladderExtremeSpreads(
      [pair('a', 0, 100, 0.02), pair('b', 0, 100, 0.04), pair('c', 5, 100, 0.01)],
      [0.003, 0.0031],
    )
    expect(rows).toHaveLength(1)
    expect(defined(rows[0]).charge).toBe(0.003)
    expect(defined(rows[0]).length).toBeCloseTo(0.03, 15)
  })
})

describe('close-the-page copies', () => {
  const at = (id: string, saved: string) => ({ id, saved: `2026-10-15T10:00:0${saved}.000Z` })

  it('merges by id and keeps the newer copy, also of another tab', () => {
    const otherTab = [at('a', '3'), at('b', '1')]
    expect(mergeWaitingCopies(otherTab, [at('a', '2'), at('c', '1')])).toEqual([
      at('a', '3'),
      at('b', '1'),
      at('c', '1'),
    ])
    expect(mergeWaitingCopies(otherTab, [at('b', '2')])).toEqual([at('a', '3'), at('b', '2')])
  })

  it('drops a copy only up to the save that landed; a delete drops every copy of the sheet', () => {
    const list = [at('a', '3'), at('b', '1')]
    // an older save landing keeps the newer copy
    expect(withoutWaitingCopy(list, 'a', at('a', '2').saved)).toEqual(list)
    // a save of the same millisecond or later replaces it
    expect(withoutWaitingCopy(list, 'a', at('a', '3').saved)).toEqual([at('b', '1')])
    expect(withoutWaitingCopy(list, 'a', at('a', '4').saved)).toEqual([at('b', '1')])
    expect(withoutWaitingCopy(list, 'a')).toEqual([at('b', '1')])
  })

  it('keeps an edit another tab saved over as a copy under a new id', () => {
    const edit = { ...at('a', '3'), name: 'Sheet' }
    const own = keptCopy(edit, 'b', english.t)
    expect(own).toEqual({ ...edit, id: 'b', name: 'Sheet (copy)' })
    expect(keptNote(own.name, english.t)).toBe(
      'Changed in another tab: your edits are kept as Sheet (copy).',
    )
    // within the 200 characters of a record name
    expect(keptCopy({ ...edit, name: 'x'.repeat(200) }, 'b', english.t).name).toHaveLength(200)
  })
})

describe('newGroup', () => {
  it('names the group after its place, in the language shown', () => {
    const sheet = { references: [], targetRotation: 0, groups: [group] }
    expect(newGroup(sheet, 'g2', 100, english.t).name).toBe('Group 2')
    expect(newGroup(sheet, 'g2', 100, translator(de, 'de').t).name).toBe('Schussbild 2')
  })
})
