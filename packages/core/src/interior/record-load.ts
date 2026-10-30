import { type CartridgeSpecs, cartridgeBulletDiameterMm } from '../cartridge-specs.ts'
import { InputError, need } from '../errors.ts'
import { type ResistanceTerms, recordResistance } from './bore-resistance.ts'
import { interiorLoad } from './load-file.ts'
import type { InteriorLoad } from './model.ts'
import { type PowderInteriorRecord, powderModelValues } from './workbench-keys.ts'

/** The powder record values {@link recordLoad} reads, in stored units. */
export interface RecordPowder {
  interior?:
    | (NonNullable<PowderInteriorRecord['interior']> & {
        /** Propellant temperature of the fit, degC. */
        propellantTemperature: { value: number }
        resistance?: ({ stress: { value: number } } & Omit<ResistanceTerms, 'stress'>) | undefined
      })
    | undefined
  /** Burn-rate sensitivity: `reference` in K, `cold` and `hot` in 1/K. */
  temperatureSensitivity?:
    | { reference: { value: number }; cold: { value: number }; hot: { value: number } }
    | undefined
}

/** What {@link recordLoad} builds a run from: the records and the load's own values. */
export interface RecordRun {
  /** The cartridge record: chamber F, u, Q and Z, cartridge G1, in mm. */
  cartridge: CartridgeSpecs
  powder: RecordPowder
  bullet: {
    /** Mass, kg. */
    mass: number
    /** Length, mm; needed for the bore resistance of a powder that has the law. */
    lengthMm?: number | undefined
  }
  /** Charge, kg. */
  charge: number
  /** Volume behind the seated bullet, m3. */
  volume: number
  /** Bullet travel from the seated position to the muzzle, m. */
  travel: number
  /** Propellant temperature, K; default the temperature of the powder's fit. */
  temperature?: number | undefined
}

/** The first value of `symbol` on the chamber side that is not a variant, in the unit of the sheet (mm, mm2); undefined without one. */
function chamberValue(c: CartridgeSpecs, symbol: string) {
  return c.values.find(
    (v) => v.side === 'chamber' && v.symbol === symbol && !v.variant && v.value !== undefined,
  )?.value
}

/** The same in m for a length. */
function chamberMetres(c: CartridgeSpecs, symbol: string) {
  const mm = chamberValue(c, symbol)
  return mm === undefined ? undefined : mm * 1e-3
}

/**
 * The M3 run of a load that names records (`apps/docs/docs/models/interior-m3.md`, "Load from records"): the
 * powder record's model parameters, the cartridge's chamber diameter F, twist u and bore area Q
 * (else the circle of F and Z), the bore resistance of the powder's fit, the propellant temperature
 * (K) and the powder's temperature sensitivity, as the workbench fills them.
 * Throws `InputError` for a powder without an interior model or without the inputs of its bore
 * resistance, and `ValueError` for a value the records and the run lack.
 */
export function recordLoad(r: RecordRun): InteriorLoad {
  const { cartridge, powder, bullet } = r
  const model = powderModelValues(powder)
  if (model === undefined || powder.interior === undefined)
    throw new InputError('the powder has no interior model')
  const area = chamberValue(cartridge, 'Q')
  const groove = chamberValue(cartridge, 'Z')
  const load = interiorLoad(
    {
      ...model,
      bulletMass: bullet.mass,
      charge: r.charge,
      volume: r.volume,
      travel: r.travel,
      boreDiameter: chamberMetres(cartridge, 'F'),
      twist: chamberMetres(cartridge, 'u'),
      boreArea: area === undefined ? undefined : area * 1e-6,
      // the powder record stores degrees Celsius; inline, as core cannot import the schema's units
      propellantTemperature: r.temperature ?? powder.interior.propellantTemperature.value + 273.15,
    },
    undefined,
    groove === undefined ? undefined : groove * 1e-3,
  )
  const { resistance, missing } = recordResistance(powder, {
    boreDiameter: load.chamber.boreDiameter,
    boreArea: load.chamber.boreArea,
    startPressure: load.startPressure,
    cartridge: { g1: cartridgeBulletDiameterMm(cartridge), z: groove },
    bulletLengthMm: bullet.lengthMm,
  })
  need(missing.length === 0, `the bore resistance of the powder needs ${missing.join(' and ')}`)
  const s = powder.temperatureSensitivity
  return {
    ...load,
    ...(resistance && { resistance }),
    ...(s && {
      propellant: {
        ...load.propellant,
        temperatureSensitivity: {
          reference: s.reference.value,
          cold: s.cold.value,
          hot: s.hot.value,
        },
      },
    }),
  }
}
