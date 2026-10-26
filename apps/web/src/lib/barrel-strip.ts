import {
  fullSection,
  type SectionPoint,
  type SpecValue,
  steelBand,
  svgPath,
} from '@open-reloading/drawing'
import { previewDrawn } from '@open-reloading/drawing/seating'
import { fromSi } from '@open-reloading/schema'
import { nth } from './nth.ts'

/**
 * What the barrel strip of the interior chart draws, taken from the seated preview at the
 * run: the cartridge record's values, the seated bullet's half outline ([r, z] mm, z from its base)
 * and the base's z from the head, mm.
 */
export type StripFigure = {
  values: SpecValue[]
  table?: string | undefined
  bullet: SectionPoint[]
  base: number
}

/** The strip's paths in the part frame (mm, x along the axis from the head), to scale. */
export type StripModel = {
  cavity: string
  steel: string
  outline: string
  cartridge: string
  /** In the bullet's frame: x from its base. */
  bullet: string
  base: number
  /** z of the muzzle from the head, mm. */
  muzzle: number
  /** viewBox: x, y, width, height. */
  view: [number, number, number, number]
}

/** Text size the steel band's break line scales with, mm. */
const em = 2.5

/**
 * The record's case (CIP maximum) in its chamber (CIP minimum) with the bore run out to the muzzle
 * at the seated base plus the simulated travel (m), so the bullet leaves the drawn barrel where the
 * simulation ends; undefined when the record lacks a value the outlines need.
 */
export function stripModel(f: StripFigure, travel: number): StripModel | undefined {
  const muzzle = f.base + fromSi('length', travel)
  const drawn = previewDrawn(f.values, f.table, muzzle)
  if ('missing' in drawn) return
  const [cartridge, chamber] = [nth(drawn, 0).p.points, nth(drawn, 1).p.points]
  const band = steelBand(chamber, em)
  const r = band.outer + 1
  return {
    cavity: svgPath(fullSection(chamber), true),
    steel: band.sides.map((s) => svgPath(s.polygon, true)).join(''),
    outline: band.sides.map((s) => svgPath(s.stroke)).join(''),
    cartridge: svgPath(fullSection(cartridge), true),
    bullet: svgPath(fullSection(f.bullet), true),
    base: f.base,
    muzzle,
    view: [-1, -r, muzzle + 2, 2 * r],
  }
}

/** z of the bullet base from the head at the simulated travel (m), mm. */
export const baseAt = (m: StripModel, travel: number) => m.base + fromSi('length', travel)

/**
 * z of the bullet base (mm) `dt` s after muzzle exit: from the base at the muzzle sample's
 * travel (m) on at its velocity (m/s), to the strip's scale.
 */
export const flightAt = (m: StripModel, muzzle: { travel: number; velocity: number }, dt: number) =>
  baseAt(m, muzzle.travel) + fromSi('length', muzzle.velocity * dt)

/** Seconds after muzzle exit until the bullet base reaches z (mm); 0 for a z behind it or no velocity. */
export function flightTime(m: StripModel, muzzle: { travel: number; velocity: number }, z: number) {
  const d = z - baseAt(m, muzzle.travel)
  return d > 0 && muzzle.velocity > 0 ? d / fromSi('length', muzzle.velocity) : 0
}
