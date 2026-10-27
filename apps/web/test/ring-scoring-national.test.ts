import { readRecords } from '@open-reloading/data'
import type { TargetFace } from '@open-reloading/schema'
import { describe, expect, it } from 'vitest'
import { scoredHoleDiameter, scoreGroupOnFace, scoreShot } from '../src/lib/ring-scoring.ts'
import { matchFaces } from '../src/lib/target-face.ts'
import { defined } from './defined.ts'

const { bundle } = readRecords()
const faces = bundle.targetFaces
const face = (id: string) => faces.find((f) => f.id === id) as TargetFace

const mm = 1e-3
const off = 1e-6
const at = (d: number) => ({ x: d * mm, y: 0 })

/**
 * Ring diameters in mm, ring 10 first, as the cited rule-book page prints them. Each ring scores
 * for a hole whose edge touches the ring line (the touch rule of the DSB, BDS, BDMP and VdRBw and of
 * the DSU outside black powder, which counts the hole centre: see the black-powder test), so a hole
 * of diameter `hole` centred at d = R + hole / 2 scores the ring, and a hair further out the ring
 * outside it, or 0 outside the outermost.
 */
function boundaries(id: string, printed: number[], hole: number) {
  const f = face(id)
  expect(f.rings.map((r) => r.diameter.value)).toEqual(printed.toReversed())
  printed.forEach((diameter, i) => {
    const value = 10 - i
    const edge = diameter / 2 + hole / 2
    expect(scoreShot(f, at(edge), hole * mm).value).toBe(value)
    const outside = value === defined(f.rings[0]).value ? 0 : value - 1
    expect(scoreShot(f, at(edge + off), hole * mm).value).toBe(outside)
  })
}

describe('DSB Sportordnung 01.01.2026, 0.20 Scheibe Nr. 2 and Nr. 8', () => {
  it('scores the 15 m rifle face by its printed ring diameters (Teil 0 Seite 64)', () => {
    boundaries(
      'dsb-nr2-15m-rifle',
      [4.5, 13.5, 22.5, 31.5, 40.5, 49.5, 58.5, 67.5, 76.5, 85.5],
      4.65,
    )
  })

  it('scores the 10 m rapid-fire part from the 5 ring and counts the 11.0 mm inner ten (Seite 67)', () => {
    boundaries('dsb-nr8-10m-rapid-fire', [22, 48.5, 75, 101.5, 128, 154.5], 4.5)
    const f = face('dsb-nr8-10m-rapid-fire')
    // 5.5 + 2.25: the hole touches the inner ten circle
    expect(scoreShot(f, at(7.75), 4.5 * mm).innerTen).toBe(true)
    expect(scoreShot(f, at(7.75 + off), 4.5 * mm)).toMatchObject({ value: 10, innerTen: false })
  })

  it('scores a DSB event on an ISSF face with the gauge of 0.11.3.2', () => {
    const rifle = face('issf-300m-rifle')
    const event = rifle.events.find((e) => e.name === 'DSB Gewehr 300 m')
    // measuring ring 8.00 mm for rifles above .22 lfb
    expect(event?.gauge?.value).toBe(8)
    expect(event?.federation).toBe('dsb')
    expect(scoreShot(rifle, at(50 + 4), 8 * mm).value).toBe(10)
    expect(scoreShot(rifle, at(50 + 4 + off), 8 * mm).value).toBe(9)
  })
})

describe('BDS Sporthandbuch Zielscheiben, Z19 BDS-300m-PG-Scheibe (printed Z-19)', () => {
  it('derives rings 6 to 10 from the ten (34 mm) and the ring width (17 mm radial)', () => {
    const printed = [34, 68, 102, 136, 170]
    boundaries('bds-z19-300m-pg', printed, 7.62)
    const f = face('bds-z19-300m-pg')
    expect(f.blackDiameter.value).toBe(170)
    expect(f.innerTen?.diameter.value).toBe(17)
    // below the 6 ring (170 mm) the face scores nothing
    expect(scoreShot(f, at(100), 7.62 * mm).value).toBe(0)
  })
})

describe('BDMP Sportordnung 24.02.2026, B.11.2 BDMP-Scheibe Nr. 1', () => {
  it('scores the 100 m face: ten 3.4 cm, spacing 1.7 cm, outer circle 34 cm', () => {
    boundaries('bdmp-nr1-100m', [34, 68, 102, 136, 170, 204, 238, 272, 306, 340], 7.62)
    expect(face('bdmp-nr1-100m').innerTen?.diameter.value).toBe(17)
  })

  it('keeps the VdRBw .30 M1 face out of the record, with the disagreement in the note', () => {
    const f = face('bdmp-nr1-100m')
    expect(defined(f.rings[0]).diameter.value).toBe(340)
    const vdrbw = f.provenance.sources.find((s) => s.note?.startsWith('VdRBw 10.5'))
    expect(vdrbw?.note).toContain('1.65 cm')
    expect(vdrbw?.note).toContain('33.3 cm')
  })

  it('scales the face by one half for 50 m and one quarter for 25 m', () => {
    expect(face('bdmp-nr1-50m').rings.map((r) => r.diameter.value)).toEqual(
      face('bdmp-nr1-100m').rings.map((r) => r.diameter.value / 2),
    )
    expect(face('bdmp-nr1-25m').rings.map((r) => r.diameter.value)).toEqual(
      face('bdmp-nr1-100m').rings.map((r) => r.diameter.value / 4),
    )
  })
})

describe('BDMP Sportordnung 24.02.2026, A.3.21.4.1 black-powder disciplines', () => {
  it('counts the hole centre in PVDG 1, PHDG 1, PFG 1 and SDG 1, and keeps SPPDG 1 on touch', () => {
    const pistol = face('issf-25m-precision-50m-pistol')
    const rifle = face('issf-300m-rifle')
    const event = (f: TargetFace, key: string) => f.events.find((e) => e.name.includes(key))
    for (const [f, key] of [
      [pistol, 'PVDG 1'],
      [pistol, 'PHDG 1'],
      [pistol, 'PFG 1'],
      [rifle, 'SDG 1'],
    ] as const)
      expect(event(f, key)?.scoring).toBe('centre')
    expect(event(pistol, 'SPPDG 1')?.scoring).toBe('touch')

    // ten ring R = 25 mm, 10 mm bullet: the centre at 27.5 mm lies on the 9, the edge touches the 10
    const centred = scoredHoleDiameter(event(pistol, 'PVDG 1'), 10 * mm)
    const touched = scoredHoleDiameter(event(pistol, 'SPPDG 1'), 10 * mm)
    expect(centred).toBe(0)
    expect(touched).toBe(10 * mm)
    expect(scoreShot(pistol, at(27.5), centred).value).toBe(9)
    expect(scoreShot(pistol, at(27.5), touched).value).toBe(10)
    // the centre on the ring line counts the ring
    expect(scoreShot(pistol, at(25), centred).value).toBe(10)
    expect(scoreShot(pistol, at(25 + off), centred).value).toBe(9)
  })
})

describe('DSU Sporthandbuch 2018, DSU-Scheibe 200 Meter Präzision (Seite 19, PDF p. 21)', () => {
  it('draws the French military face: ten 80 mm, spacing 40 mm, scoring area 800 mm', () => {
    // the ring lines by touch with a 15 mm hole; the black-powder event counts the centre, below
    boundaries('dsu-french-military-200m', [80, 160, 240, 320, 400, 480, 560, 640, 720, 800], 15)
    expect(face('dsu-french-military-200m').blackDiameter.value).toBe(400)
  })

  it('counts the hole centre in the black-powder events (Kapitel 4, PDF p. 126), not the edge', () => {
    const f = face('dsu-french-military-200m')
    const event = f.events.find((e) => e.name.startsWith('SVSM'))
    expect(event?.scoring).toBe('centre')
    const hole = scoredHoleDiameter(event, 15 * mm)
    expect(hole).toBe(0)
    // d = 47.5 mm with a 15 mm hole: the edge touches the 10 ring (R = 40 mm), the centre lies on the 9
    expect(scoreShot(f, at(47.5), 15 * mm).value).toBe(10)
    expect(scoreShot(f, at(47.5), hole).value).toBe(9)
    // the centre on the ring line counts the ring, a hair outside it does not
    expect(scoreShot(f, at(40), hole).value).toBe(10)
    expect(scoreShot(f, at(40 + off), hole).value).toBe(9)
    expect(scoreShot(f, at(400), hole).value).toBe(1)
    expect(scoreShot(f, at(400 + off), hole).value).toBe(0)
    // no bullet size needed: the hole size does not enter
    const scored = scoreGroupOnFace(
      f,
      { id: f.id, event: event?.id },
      { shots: [at(47.5)] },
      undefined,
    )
    expect('error' in scored).toBe(false)
    if (!('error' in scored)) expect(scored.score.total).toBe(9)
  })

  it('stores the centre rule on every DSU, BDMP and DSB black-powder event and the DSB Ordonnanzgewehr, and on no other', () => {
    const names = faces.flatMap((f) =>
      f.events.filter((e) => e.scoring === 'centre').map((e) => e.name),
    )
    expect(names.sort()).toEqual([
      'BDMP LRSPFG LR Schwarzpulverfreigewehr, 100 m',
      'BDMP LRSPFG LR Schwarzpulverfreigewehr, 300 m',
      'BDMP PFG 1 Perkussions-Freigewehr 1',
      'BDMP PFG 2 Perkussions-Freigewehr 2',
      'BDMP PHDG 1 Perkussions-Hinterlader-DG 1',
      'BDMP PVDG 1 Perkussions-Vorderlader-DG 1',
      'BDMP SDG 1 Steinschloss-Dienstgewehr 1',
      'BDMP SDP 1 Steinschloss-Dienstpistole 1',
      'BDMP SDP 2 Steinschloss-Dienstpistole 2',
      'BDMP SPFG3 LR Schwarzpulverfreigewehr, 300 bis 900 m',
      'BDMP SPFG3 ZF Schwarzpulverfreigewehr, 300 bis 900 m',
      'BDMP SPFG3 ZF Schwarzpulverfreigewehr, 300 bis 900 m',
      'BDMP SPPDG 2 Schwarzpulverpatronen-DG 2',
      'BDMP VDR 1 Vorderlader-Dienstrevolver 1',
      'BDMP VDR 2 Vorderlader-Dienstrevolver 2',
      'BDMP VP 1 Vorderladerpistole 1',
      'BDMP ZFSPFG ZF Schwarzpulverfreigewehr, 100 m',
      'BDMP ZFSPFG ZF Schwarzpulverfreigewehr, 300 m',
      'DSB 25 m Luntenschlosspistole',
      'DSB 25 m Perkussionspistole',
      'DSB 25 m Perkussionspistole - Auflage',
      'DSB 25 m Perkussionsrevolver',
      'DSB 25 m Steinschlosspistole',
      'DSB Luntenschlossgewehr 50 m',
      'DSB Luntenschlossgewehr 50 m',
      'DSB Muskete 50 m',
      'DSB Ordonnanzgewehr 100 m',
      'DSB Perkussionsdienstgewehr 100 m',
      'DSB Perkussionsdienstgewehr 50 m',
      'DSB Perkussionsfreigewehr 100 m',
      'DSB Perkussionsfreigewehr 300 m',
      'DSB Perkussionsgewehr 50 m',
      'DSB Perkussionsgewehr 50 m - Auflage',
      'DSB Steinschlossgewehr 100 m',
      'DSB Steinschlossgewehr 50 m',
      'DSU SHG Schwarzpulver-Hinterladergewehr 50 m',
      'DSU SHKE 1 Schwarzpulver Klassisches Einzelladergewehr, geschlossene Visierung 100 m',
      'DSU SVFG Vorderlader-Freigewehr 100 m',
      'DSU SVOG Vorderlader-Ordonanzgewehr 100 m',
      'DSU SVPG 1 Vorderlader-Perkussionsscheibengewehr 50 m',
      'DSU SVPP Perkussionspistole 25 m',
      'DSU SVPR 1 Perkussionsrevolver gR 25 m',
      'DSU SVPR 2 Perkussionsrevolver oR 25 m',
      'DSU SVSG 1 Vorderlader-Steinschlossgewehr 50 m',
      'DSU SVSG 2 Vorderlader-Steinschlossgewehr 100 m',
      'DSU SVSP Steinschlosspistole 25 m',
      'SHFR Schwarzpulver Frühe Repetiergewehre für Schwarzpulverpatronen',
      'SHSA Schwarzpulver Single Action Revolver',
      'SVSM Vorderlader-Steinschlossmuskete 50 m',
    ])
    for (const f of faces)
      for (const e of f.events)
        if (/^(DSU )?(SV|SHG)|^DSB .*(Perkussion|Steinschloss|Luntenschloss|Muskete)/.test(e.name))
          expect(e.scoring).toBe('centre')
  })
})

describe('VdRBw Schießsportordnung, 10.3 Pistolen- und Gewehrscheibe (Seite 98, PDF p. 98)', () => {
  it('scores a VdRBw event on the ISSF 25 m face: ten 5 cm, spacing 2.5 cm, outer circle 50 cm', () => {
    boundaries(
      'issf-25m-precision-50m-pistol',
      [50, 100, 150, 200, 250, 300, 350, 400, 450, 500],
      9,
    )
    const event = face('issf-25m-precision-50m-pistol').events.find(
      (e) => e.name === 'VdRBw P-D 1 Halbautomatische Dienstpistole Präzision',
    )
    expect(event).toMatchObject({ federation: 'vdrbw', section: '8.2.5, 8.2.6 (Scheibe 10.3)' })
    expect(event?.distance.value).toBe(25000)
  })
})

describe('national events', () => {
  it('put the events that name only the VdRBw face 10.1 on its own faces (black rings 8 and 9, no mouche)', () => {
    for (const f of faces)
      for (const e of f.events)
        if (e.section?.includes('Scheibe 10.1') && !e.section.includes('10.3'))
          expect(f.id).toMatch(/^vdrbw-bw-nr2/)
  })

  it('have names and ids unique within a face, and one of another federation carries its abbreviation', () => {
    const abbreviation = new Map(bundle.federations.map((x) => [x.id, x.abbreviation]))
    for (const f of faces) {
      expect(new Set(f.events.map((e) => e.name)).size).toBe(f.events.length)
      expect(new Set(f.events.map((e) => e.id)).size).toBe(f.events.length)
      for (const e of f.events) {
        if (e.federation) expect(e.name.startsWith(`${abbreviation.get(e.federation)} `)).toBe(true)
        if (e.federation && e.federation !== f.federation) expect(e.section).toBeDefined()
      }
    }
  })
})

describe('DSU Sporthandbuch 2018, oval-ring faces b2 to b5 Präzision (Kapitel 1, Seiten 12 bis 16)', () => {
  // width and height in mm of the scoring area, the ten and the Mouche as the book prints them
  const printed = {
    'dsu-b2': { outer: [355, 555], ten: [65, 101], mouche: [32, 51] },
    'dsu-b3': { outer: [246, 380], ten: [45, 69], mouche: [23, 34] },
    'dsu-b4': { outer: [178, 278], ten: [33, 51], mouche: [16, 25] },
    'dsu-b5': { outer: [126, 196], ten: [23, 35], mouche: [11, 18] },
    'dsu-b5-precision': { outer: [93, 146], ten: [17, 26], mouche: [8.5, 13] },
  } as const

  for (const [id, p] of Object.entries(printed)) {
    const f = face(id)
    const size = (r: { diameter: { value: number }; height?: { value: number } | undefined }) => [
      r.diameter.value,
      r.height?.value,
    ]

    it(`${id} has ten stadium rings from the printed outer ring to the printed ten`, () => {
      expect(f.rings.map((r) => r.value)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
      expect(f.rings.every((r) => r.shape === 'stadium')).toBe(true)
      expect(size(defined(f.rings[0]))).toEqual(p.outer)
      expect(size(defined(f.rings[9]))).toEqual(p.ten)
      expect(size(defined(f.innerTen))).toEqual(p.mouche)
      expect(f.photoSearch).toBe(false)
    })

    it(`${id} scores on the straight sides and on the curved ends of every ring`, () => {
      for (const r of f.rings) {
        const w = r.diameter.value / 2
        const h = defined(r.height).value / 2
        const inside = r.value
        const outside = r.value === 1 ? 0 : r.value - 1
        // the straight side at the middle and at the end of the straight part, then the pole
        for (const [x, y] of [
          [w, 0],
          [w, h - w],
          [0, h],
        ] as const) {
          expect(scoreShot(f, { x: x * mm, y: y * mm }, 0).value).toBe(inside)
          expect(scoreShot(f, { x: (x + off) * mm, y: (y + off) * mm }, 0).value).toBe(outside)
        }
        // 45 degrees on the end half circle about (0, h - w)
        const k = w * Math.SQRT1_2
        expect(scoreShot(f, { x: k * mm, y: (h - w + k) * mm }, 0).value).toBe(inside)
        expect(scoreShot(f, { x: (k + off) * mm, y: (h - w + k + off) * mm }, 0).value).toBe(
          outside,
        )
      }
    })
  }
  it('are skipped by the photo face search', () => {
    const dsu = Object.keys(printed).map(face)
    const black = { centreX: 0, centreY: 0, semiMajor: 100, semiMinor: 60, angle: 0 }
    expect(matchFaces(black, [], dsu)).toEqual([])
    expect(dsu.every((f) => f.federation === 'dsu')).toBe(true)
  })
})
