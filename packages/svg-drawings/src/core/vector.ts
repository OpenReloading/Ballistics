import type { PartPoint } from './section.ts'

export const add = (a: PartPoint, b: PartPoint, s = 1): PartPoint => [
  a[0] + b[0] * s,
  a[1] + b[1] * s,
]
export const unit = (a: PartPoint, b: PartPoint): PartPoint => {
  const l = Math.hypot(b[0] - a[0], b[1] - a[1])
  return l > 1e-12 ? [(b[0] - a[0]) / l, (b[1] - a[1]) / l] : [1, 0]
}
/** The consecutive pairs of a list: (0, 1), (1, 2), and so on. */
export const pairs = <T>(list: T[]): [T, T][] =>
  list.slice(1).flatMap((b, n) => {
    const a = list[n]
    return a === undefined ? [] : [[a, b]]
  })
/** The edges of a closed polygon: the consecutive pairs, then the last point back to the first. */
export const closedEdges = <T>(list: T[]): [T, T][] => {
  const [first, last] = [list[0], list[list.length - 1]]
  return first === undefined || last === undefined ? [] : [...pairs(list), [last, first]]
}
export const polar = (c: PartPoint, r: number, a: number): PartPoint => [
  c[0] + r * Math.cos(a),
  c[1] + r * Math.sin(a),
]
