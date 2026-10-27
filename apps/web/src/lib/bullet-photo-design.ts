/**
 * What a bullet photograph's measurements become in the bullet designer: the design they seed, the
 * note that keeps their uncertainties, the lines of the values table and the comparison with a
 * catalogue record (`apps/docs/docs/models/bullet-photo.md`).
 */
import { type Design, type DesignerSpec, designerSpecs } from './bullet-designer.ts'
import type { Scale } from './bullet-photo.ts'
import {
  type BulletMeasurement,
  type Measured,
  type PhotoField,
  photoFields,
} from './bullet-photo-measure.ts'
import { fieldOf, siToStored, storedToSi } from './field-spec.ts'
import type { UnitSystem } from './units.ts'

type StoredQuantity = Parameters<typeof storedToSi>[0]
const quantityOf = (s: DesignerSpec) => s.quantity as StoredQuantity

const isPhotoField = (k: string): k is PhotoField => (photoFields as readonly string[]).includes(k)

/** The designer fields a photograph gives, in the designer's order. */
const specs: DesignerSpec[] = designerSpecs.filter((s) => isPhotoField(s.key))

/** Decimals that show a standard uncertainty at two significant digits. */
const decimalsFor = (u: number, fallback: number) =>
  u > 0 ? Math.min(6, Math.max(0, 1 - Math.floor(Math.log10(u)))) : fallback

/** A stored value or uncertainty in the units of `system`; an uncertainty is a difference, so the offset of a unit drops out. */
const shown = (s: DesignerSpec, system: UnitSystem, stored: number, difference: boolean) => {
  const unit = system[s.quantity]
  const from = (v: number) => unit.fromSi(storedToSi(quantityOf(s), v))
  return difference ? Math.abs(from(stored) - from(0)) : from(stored)
}

/** A value in the units of `system` with its standard uncertainty at two significant digits: "31.49 ± 0.05 mm". */
export function valueText(s: DesignerSpec, system: UnitSystem, v: Measured): string {
  const unit = system[s.quantity]
  const u = shown(s, system, v.uncertainty, true)
  const d = decimalsFor(u, unit.decimals)
  const text = `${shown(s, system, v.value, false).toFixed(d)} ± ${u.toFixed(d)}`
  return unit.symbol ? `${text} ${unit.symbol}` : text
}

/** A stored value in the units of `system`, with its symbol. */
export function storedText(s: DesignerSpec, system: UnitSystem, stored: number): string {
  const unit = system[s.quantity]
  const text = shown(s, system, stored, false).toFixed(unit.decimals)
  return unit.symbol ? `${text} ${unit.symbol}` : text
}

/** One line of the values table. */
export interface PhotoRow {
  spec: DesignerSpec
  value: Measured
  /** The catalogue record's value, stored units, when a record is chosen and has one. */
  record?: number
  /** The photograph is away from the record by more than 3 standard uncertainties and 2 % of the record's value. */
  differs: boolean
}

/**
 * The values of a measurement as table rows. `record` holds the SI values of the catalogue record
 * the designer started from: a row it covers carries the record's value, and `differs` when the
 * photograph is away from it by more than three standard uncertainties and 2 % (a manufacturing
 * spread is no flag). The record is never changed.
 */
export function photoRows(
  m: BulletMeasurement,
  record: Record<string, number | undefined> | undefined,
): PhotoRow[] {
  return specs.flatMap((spec): PhotoRow[] => {
    const value = m.values[spec.key as PhotoField]
    if (!value) return []
    const si = record?.[spec.key]
    const stored = si === undefined ? undefined : siToStored(quantityOf(spec), si)
    const away = stored === undefined ? 0 : Math.abs(value.value - stored)
    return [
      {
        spec,
        value,
        ...(stored !== undefined && { record: stored }),
        differs:
          stored !== undefined && away > 3 * value.uncertainty && away > 0.02 * Math.abs(stored),
      },
    ]
  })
}

/** What a measurement was made from: the cut-out, the ruler's scale, the caliper sizes and the fixed axis direction (undefined when found). */
export interface MeasuredInputs {
  cut: unknown
  scale: Scale | undefined
  axis: number | undefined
  known?: unknown
}

/** Whether a measurement made from `made` still answers the inputs `now`: the same cut-out, scale and caliper size objects and axis. */
export const measuredFor = (made: MeasuredInputs, now: MeasuredInputs): boolean =>
  made.cut === now.cut &&
  made.scale === now.scale &&
  made.known === now.known &&
  made.axis === now.axis

/** What the note says about the photograph: its size and scale, never its file. */
export interface PhotoFacts {
  width: number
  height: number
  scale: Scale
}

const noteUnits: Partial<Record<DesignerSpec['quantity'], string>> = { length: 'mm', angle: '°' }

/**
 * The note kept on the design: that the values are measured from a photograph, at what scale, and
 * each value with its standard uncertainty in the stored units. No image is stored.
 */
export function photoNote(m: BulletMeasurement, facts: PhotoFacts): string {
  const parts = specs.flatMap((s) => {
    const v = m.values[s.key as PhotoField]
    if (!v) return []
    const d = decimalsFor(v.uncertainty, 3)
    const unit = noteUnits[s.quantity]
    return [
      `${s.label.toLowerCase()} ${v.value.toFixed(d)} ± ${v.uncertainty.toFixed(d)}${unit ? ` ${unit}` : ''}`,
    ]
  })
  const { width, height, scale } = facts
  return [
    `Measured from a photograph (${width} × ${height} px, ${scale.pxPerMm.toFixed(2)} px/mm ± ${(100 * scale.relUncertainty).toFixed(2)} %, no image stored).`,
    `Values with standard uncertainty: ${parts.join('; ')}.`,
  ].join(' ')
}

/**
 * The design a measurement seeds: the measured values, the nose form and base type the photograph
 * shows, the mass and the manufacturer left empty, and the note with every uncertainty. A tangent
 * nose carries Rt/R of 1 and a secant nose its circle radius; the designer derives the other from
 * the nose length, so the two never disagree.
 */
export function photoDesign(m: BulletMeasurement, facts: PhotoFacts, system: UnitSystem): Design {
  const given = (s: DesignerSpec): number | undefined => {
    if (s.key === 'ogive.radiusRatio') return m.ogiveForm === 'tangent' ? 1 : undefined
    if (s.key === 'ogive.radius' && m.ogiveForm !== 'secant') return undefined
    const v = m.values[s.key as PhotoField]
    return v && storedToSi(quantityOf(s), v.value)
  }
  return {
    name: '',
    choices: { 'base.type': m.baseType, 'ogive.form': m.ogiveForm ?? '', 'tip.type': '' },
    fields: Object.fromEntries(designerSpecs.map((s) => [s.key, fieldOf(system, s, given(s))])),
    kept: { note: photoNote(m, facts) },
  }
}
