/** What a photograph's measurements become in the bullet designer (`apps/docs/docs/models/bullet-photo.md`). */

import { fixedNumber } from '../i18n/number.ts'
import type { Translator } from '../i18n/translate.ts'
import { type Design, type DesignerSpec, designerSpecs } from './bullet-designer.ts'
import type { Scale } from './bullet-photo.ts'
// types only: the designer imports this module, and the image maths stays out of its first load
import type { BulletMeasurement, Measured, PhotoField } from './bullet-photo-measure.ts'
import { basisNote } from './bullet-photo-scale.ts'
import { fieldOf, siToStored, storedToSi } from './field-spec.ts'
import type { UnitSystem } from './units.ts'

type StoredQuantity = Parameters<typeof storedToSi>[0]
const quantityOf = (s: DesignerSpec) => s.quantity as StoredQuantity

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
  const text = `${fixedNumber(shown(s, system, v.value, false), d)} ± ${fixedNumber(u, d)}`
  return unit.symbol ? `${text} ${unit.symbol}` : text
}

/** A stored value in the units of `system`, with its symbol. */
export function storedText(s: DesignerSpec, system: UnitSystem, stored: number): string {
  const unit = system[s.quantity]
  const text = fixedNumber(shown(s, system, stored, false), unit.decimals)
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

/** `record`: the catalogue record's SI values; `differs` beyond three standard uncertainties and 2 %, so a manufacturing spread is no flag; the record is never changed. */
export function photoRows(
  m: BulletMeasurement,
  record: Record<string, number | undefined> | undefined,
): PhotoRow[] {
  return designerSpecs.flatMap((spec): PhotoRow[] => {
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

/** What the design keeps of the photograph: its size and scale, never its file. */
export interface PhotoFacts {
  width: number
  height: number
  scale: Scale
}

/** The stored measurement in the language and units shown: size and scale of the photograph, what the scale rests on, each value with its standard uncertainty. */
export function photoText(
  photo: NonNullable<Design['photo']>,
  system: UnitSystem,
  t: Translator['t'],
): string[] {
  const basis = basisNote(photo.scaleBasis)
  const values = designerSpecs.flatMap((s) => {
    const v = photo.values[s.key as PhotoField]
    return v
      ? [
          `${t(s.label)} ${valueText(s, system, { value: v.value, uncertainty: v.standardUncertainty })}`,
        ]
      : []
  })
  return [
    t(
      'Measured from a photograph ({width} × {height} px, {scale} px/mm ± {uncertainty} %, no image stored).',
      {
        width: photo.width,
        height: photo.height,
        scale: fixedNumber(photo.pxPerMm, 2),
        uncertainty: fixedNumber(100 * photo.relativeStandardUncertainty, 2),
      },
    ),
    ...(basis ? [t(basis)] : []),
    ...(values.length > 0
      ? [t('Values with standard uncertainty: {values}.', { values: values.join('; ') })]
      : []),
  ]
}

/** A tangent nose carries Rt/R 1 and a secant nose its radius; the designer derives the other, so the two never disagree. */
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
    photo: {
      width: facts.width,
      height: facts.height,
      pxPerMm: facts.scale.pxPerMm,
      relativeStandardUncertainty: facts.scale.relUncertainty,
      ...(m.scaleBasis && { scaleBasis: m.scaleBasis }),
      values: Object.fromEntries(
        Object.entries(m.values).map(([k, v]) => [
          k,
          { value: v.value, standardUncertainty: v.uncertainty },
        ]),
      ),
    },
  }
}
