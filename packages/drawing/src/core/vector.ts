import type { PartPoint } from './section.ts'

export const add = (a: PartPoint, b: PartPoint, s = 1): PartPoint => [
  a[0] + b[0] * s,
  a[1] + b[1] * s,
]
export const unit = (a: PartPoint, b: PartPoint): PartPoint => {
  const l = Math.hypot(b[0] - a[0], b[1] - a[1])
  return l > 1e-12 ? [(b[0] - a[0]) / l, (b[1] - a[1]) / l] : [1, 0]
}
export const polar = (c: PartPoint, r: number, a: number): PartPoint => [
  c[0] + r * Math.cos(a),
  c[1] + r * Math.sin(a),
]
