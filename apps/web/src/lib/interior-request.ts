import {
  defaultSensitivity,
  type InteriorLoad,
  overrideResistance,
  recordResistance,
  recordSensitivity,
  sensitivityReferenceDefault,
} from '@open-reloading/ballistics'
import { type Powder, toSi } from '@open-reloading/schema'
import { type InteriorBody, interiorBody } from './interior-input.ts'
import type { RecordValues } from './query.ts'

/** What a link carried of a powder record that is not loaded, SI. */
type LinkedPowder = NonNullable<RecordValues['powder']>

/** What the workbench's interior run reads besides the field values; lengths in mm as the records give them. */
export interface InteriorSources {
  /** The SI field values of the run, the powder record's model parameters already laid over them. */
  values: Record<string, number | undefined>
  /** The powder record of the run, or the powder of a user design. */
  powder: Powder | undefined
  /** A missing powder record: the bulk density and the bore resistance its link carried. */
  linked?: LinkedPowder | undefined
  /** The chosen cartridge: its id and CIP G1, mm. */
  cartridge?: { id: string; g1?: number | undefined } | undefined
  /** The loaded cartridge record: its id and groove diameter Z, mm. */
  groove?: { id: string; z?: number | undefined } | undefined
  /** The record's bore area Q, m2, the fallback of an empty Bore area. */
  boreArea?: number | undefined
  /** The record's groove diameter Z, m, the fallback of an empty bore area without Q. */
  grooveDiameter?: number | undefined
  /** The bullet record's length, mm. */
  bulletLength?: number | undefined
  /** The volume tolerance that covers the cavity depth of a hollow base (`cavityVolumeFraction`). */
  volumeFraction?: number | undefined
  /** The Pmax the user typed, Pa: the limit of the run instead of the cartridge's CIP Pmax. */
  pressureLimit?: number | undefined
  /** The bulk density the user typed, kg/m3, instead of the powder record's. */
  bulkDensity?: number | undefined
  /** The seated bullet's jump to the lands or the leade, m: the engraving ramp starts there. */
  jump?: number | undefined
}

/** 0 for a bullet touching or jammed into the lands; the friction stays. */
export function rampAtJump(
  resistance: InteriorLoad['resistance'],
  jump: number | undefined,
): InteriorLoad['resistance'] {
  const ramp = resistance?.engraving
  const first = ramp?.[0]
  if (!ramp || !first || jump === undefined) return resistance
  const shift = Math.max(0, jump) - first.travel
  return { ...resistance, engraving: ramp.map((p) => ({ ...p, travel: p.travel + shift })) }
}

/** The bore resistance of a run: the record's law, else what a link carried of it, with what the law could not apply. */
function resistanceFor(s: InteriorSources, body: InteriorBody) {
  const { powder, linked, cartridge, groove } = s
  if (!powder?.interior?.resistance)
    return {
      resistance:
        linked &&
        overrideResistance(undefined, {
          boreFriction: linked.boreFriction,
          engravingPressure: linked.engravingPressure,
          engravingLength: linked.engravingLength,
        }),
      missing: [],
    }
  if (cartridge && groove?.id !== cartridge.id)
    return { missing: ["the cartridge record's groove diameter (not loaded)"] }
  return recordResistance(powder, {
    boreDiameter: body.load.chamber.boreDiameter,
    boreArea: body.load.chamber.boreArea,
    startPressure: body.load.startPressure,
    cartridge: cartridge && {
      g1: cartridge.g1,
      z: groove?.id === cartridge.id ? groove.z : undefined,
    },
    bulletLengthMm: s.bulletLength,
  })
}

/** Shared by the workbench and powder tuning; typed friction and engraving values replace the record's terms. */
export function interiorRequest(s: InteriorSources) {
  const { values, powder } = s
  const body = interiorBody(
    { ...values, boreArea: values.boreArea ?? s.boreArea },
    s.cartridge?.id,
    s.grooveDiameter,
    s.pressureLimit,
  )
  const bulkDensity =
    s.bulkDensity ??
    (powder?.bulkDensity ? toSi('density', powder.bulkDensity.value) : s.linked?.bulkDensity)
  const { resistance, missing } = resistanceFor(s, body)
  // the workbench's ramps (record law, typed, linked) start at travel 0: the jump moves them
  const applied = rampAtJump(overrideResistance(resistance, values), s.jump)
  if (applied) body.load.resistance = applied
  if (s.volumeFraction !== undefined) body.tolerances = { volumeFraction: s.volumeFraction }
  // The record's coefficient, else its grain form's default (`recordSensitivity`, as the API's load-file route reads it).
  const linked = s.linked
  const taken = powder
    ? recordSensitivity(powder)
    : linked?.grainForm && recordSensitivity({ grainForm: linked.grainForm })
  if (taken) {
    body.load.propellant.temperatureSensitivity = {
      ...taken.sensitivity,
      ...(!powder &&
        linked?.sensitivityReference !== undefined && {
          reference: linked.sensitivityReference,
        }),
    }
  }
  const sensitivityDefault =
    taken?.fallback && taken.form ? { form: taken.form, ...taken.fallback } : undefined
  return { body, bulkDensity, missing, sensitivityDefault }
}

/** Whether a run of `powder` has a temperature sensitivity: its own, or the default of its grain form. */
export const hasSensitivity = (
  powder: Pick<Powder, 'temperatureSensitivity' | 'grainForm'> | undefined,
) =>
  powder?.temperatureSensitivity !== undefined ||
  defaultSensitivity(powder?.grainForm) !== undefined

/** The reference of a default sensitivity, K: the propellant temperature of the record's fit, else 21 °C. */
export function sensitivityReferenceOf(powder: Pick<Powder, 'interior'>): number {
  return powder.interior
    ? toSi('temperature', powder.interior.propellantTemperature.value)
    : sensitivityReferenceDefault
}
