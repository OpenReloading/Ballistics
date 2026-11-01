import {
  defaultSensitivity,
  overrideResistance,
  recordResistance,
  sensitivityReferenceDefault,
} from '@open-reloading/core'
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

/**
 * The `POST /interior` body of the workbench's run, which the workbench and the powder tuning
 * route both send: the field values with the powder record's bore resistance (the typed friction
 * and engraving values replace its terms) and temperature sensitivity, its bulk density, kg/m3, and
 * the resistance parameters it lacks. Throws on an invalid value.
 */
export function interiorRequest(s: InteriorSources) {
  const { values, powder } = s
  const body = interiorBody(
    { ...values, boreArea: values.boreArea ?? s.boreArea },
    s.cartridge?.id,
    s.grooveDiameter,
  )
  const bulkDensity = powder?.bulkDensity
    ? toSi('density', powder.bulkDensity.value)
    : s.linked?.bulkDensity
  const { resistance, missing } = resistanceFor(s, body)
  const applied = overrideResistance(resistance, values)
  if (applied) body.load.resistance = applied
  if (s.volumeFraction !== undefined) body.tolerances = { volumeFraction: s.volumeFraction }
  const sensitivity = powder?.temperatureSensitivity
  // a powder record without its own coefficient takes the default of its grain form; a missing
  // record, what its link carried of it
  const form = powder ? (sensitivity ? undefined : powder.grainForm) : s.linked?.grainForm
  const fallback = defaultSensitivity(form)
  if (sensitivity)
    body.load.propellant.temperatureSensitivity = {
      reference: sensitivity.reference.value,
      cold: sensitivity.cold.value,
      hot: sensitivity.hot.value,
    }
  else if (fallback)
    body.load.propellant.temperatureSensitivity = {
      reference: powder
        ? sensitivityReferenceOf(powder)
        : (s.linked?.sensitivityReference ?? sensitivityReferenceDefault),
      cold: fallback.cold,
      hot: fallback.hot,
    }
  const sensitivityDefault = fallback && form ? { form, ...fallback } : undefined
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
