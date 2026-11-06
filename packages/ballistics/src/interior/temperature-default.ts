/**
 * Default burn-rate temperature sensitivity of a powder without its own, by grain form
 * (`apps/docs/docs/models/interior-m3.md`, "Default by grain form"). Approximate: a value of the grain
 * form, not of the powder.
 */
import { type InteriorLoad, interior } from './model.ts'

/** Grain forms of a powder record (`grainForm`). */
export type GrainForm = 'ball' | 'extruded' | 'flake' | 'other'

/** A default sensitivity with its intervals and its source, 1/K. */
export interface SensitivityDefault {
  /** Sensitivity above the reference, 1/K. */
  hot: number
  /** Interval of `hot`, 1/K. */
  hotInterval: readonly [number, number]
  /** Sensitivity below the reference the run takes, 1/K. */
  cold: number
  /** Interval of `cold`, 1/K: the cold-side peak pressure is given over it, never as a point. */
  coldInterval: readonly [number, number]
  approximate: true
  /** Short citation; the values and their derivation are on the M3 page, "Default by grain form". */
  source: string
}

/** Reference temperature of a default without a fitted powder temperature, K (21 °C, the split of Boulkadid 2016). */
export const sensitivityReferenceDefault = 294.15

/**
 * Cold-side sensitivity interval, 1/K: the measured cold burn-rate sensitivity of ball powders,
 * 0.0012, and no significant cold change of the peak pressure (Boulkadid 2016) span it.
 */
const coldInterval = [0, 0.003] as const

const ball: SensitivityDefault = {
  hot: 0.0027,
  hotInterval: [0.0023, 0.0031],
  cold: 0.0012,
  coldInterval,
  approximate: true,
  source: 'Boulkadid 2016, doi:10.22211/cejem/67229',
}

const extruded: SensitivityDefault = {
  hot: 0.001,
  hotInterval: [0.0001, 0.0029],
  cold: 0.001,
  coldInterval,
  approximate: true,
  source: 'Hodgdon 2012 through the model (apps/docs/docs/research/powder-temperature-default.md)',
}

const defaults: Partial<Record<GrainForm, SensitivityDefault>> = {
  ball,
  extruded,
  flake: extruded,
}

/** The default sensitivity of a grain form; none for `other` or an unknown form. */
export function defaultSensitivity(form: string | undefined): SensitivityDefault | undefined {
  return form !== undefined && Object.hasOwn(defaults, form)
    ? defaults[form as GrainForm]
    : undefined
}

/**
 * The peak breech pressure of `load` (Pa) at both ends of a cold sensitivity interval, the load's
 * other inputs as they are: [low, high]. Undefined without a sensitivity, at or above its reference,
 * or when a run is invalid.
 */
export function coldPeakInterval(
  load: InteriorLoad,
  interval: readonly [number, number],
): [number, number] | undefined {
  const s = load.propellant.temperatureSensitivity
  if (!s || !(load.propellantTemperature < s.reference)) return
  const peaks = interval.map((cold) => {
    const r = interior({
      ...load,
      propellant: { ...load.propellant, temperatureSensitivity: { ...s, cold } },
    })
    return r.valid ? r.peakBreechPressure : undefined
  })
  const [a, b] = peaks
  if (a === undefined || b === undefined) return
  return [Math.min(a, b), Math.max(a, b)]
}

/** The powder record fields {@link recordSensitivity} reads, in stored units. */
export interface SensitivityPowder {
  grainForm?: string | undefined
  /** Burn-rate sensitivity: `reference` in K, `cold` and `hot` in 1/K. */
  temperatureSensitivity?:
    | { reference: { value: number }; cold: { value: number }; hot: { value: number } }
    | undefined
  /** The fitted model: its propellant temperature, degC. */
  interior?: { propellantTemperature: { value: number } } | undefined
}

/** The sensitivity a run takes, with the grain form and its default when the default was taken. */
export interface TakenSensitivity {
  /** Reference, K; cold and hot, 1/K. */
  sensitivity: { reference: number; cold: number; hot: number }
  form?: string
  fallback?: SensitivityDefault
}

/**
 * The temperature sensitivity a run of `powder` takes, K and 1/K: the record's own, else the default
 * of its grain form with the reference of the record's fit (else {@link sensitivityReferenceDefault});
 * `form` names the grain form when the default was taken. None for a powder without either.
 */
export function recordSensitivity(powder: SensitivityPowder): TakenSensitivity | undefined {
  const own = powder.temperatureSensitivity
  if (own)
    return {
      sensitivity: { reference: own.reference.value, cold: own.cold.value, hot: own.hot.value },
    }
  const fallback = defaultSensitivity(powder.grainForm)
  if (!fallback || powder.grainForm === undefined) return
  // the record stores degrees Celsius; inline, as core cannot import the schema's units
  const reference = powder.interior
    ? powder.interior.propellantTemperature.value + 273.15
    : sensitivityReferenceDefault
  return {
    sensitivity: { reference, cold: fallback.cold, hot: fallback.hot },
    form: powder.grainForm,
    fallback,
  }
}
