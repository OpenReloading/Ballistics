import {
  arrowheadCorners,
  boxesOverlap,
  labelCorners,
  polygonsOverlap,
  segHitsBox,
  segsCross,
} from '../src/core/geometry.ts'
import type { Label, Layout, LineSegment } from '../src/core/types.ts'

/** The chords of an arc, as a polyline of `steps` rules. */
export const arcLines = (a: Layout['arcs'][number], steps: number) =>
  Array.from({ length: steps }, (_, k): LineSegment => {
    const t = (n: number) => a.from + ((a.to - a.from) * n) / steps
    return {
      a: [a.c[0] + a.r * Math.cos(t(k)), a.c[1] + a.r * Math.sin(t(k))],
      b: [a.c[0] + a.r * Math.cos(t(k + 1)), a.c[1] + a.r * Math.sin(t(k + 1))],
      kind: 'rule',
      owner: a.owner,
    }
  })

/** Whether the chords of two arcs cross. */
const arcsCross = (a: Layout['arcs'][number], b: Layout['arcs'][number]) =>
  arcLines(a, 24).some((s) => arcLines(b, 24).some((t) => segsCross(s.a, s.b, t.a, t.b)))

/** What is wrong with an angle's arc and its text: the text on the arc, its flank or arrowheads, a crossing arc. */
function arcTextFailures(layout: Layout, a: Layout['arcs'][number], what: (x: string) => string) {
  const failures: string[] = []
  const l = layout.labels.find((x) => x.owner === a.owner) as Label
  const own = [...arcLines(a, 24), ...layout.segs.filter((s) => s.owner === a.owner && !s.leader)]
  if (own.some((s) => segHitsBox(s, l)))
    failures.push(what(`${a.owner} arc or flank through its text`))
  if (
    layout.arrowheads.some(
      (t) => t.owner === a.owner && polygonsOverlap(arrowheadCorners(t), labelCorners(l)),
    )
  )
    failures.push(what(`${a.owner} arrowhead on its text`))
  for (const b of layout.arcs)
    if (b.owner > a.owner && arcsCross(a, b))
      failures.push(what(`${a.owner} arc crosses ${b.owner} arc`))
  return failures
}

/** What is wrong with one drawn side in one medium and unit: texts touching, an angle text on its arc. */
export function gapFailures(layout: Layout, em: number, what: (x: string) => string) {
  const failures: string[] = []
  const gap = 0.12 * em
  for (const [k, l] of layout.labels.entries())
    for (const m of layout.labels.slice(k + 1))
      if (boxesOverlap(l, m, gap)) failures.push(what(`${l.owner} text touches ${m.owner}`))
  for (const a of layout.arcs) failures.push(...arcTextFailures(layout, a, what))
  return failures
}
