import type { PowderConfidence, PowderFit } from '@open-reloading/core'
import { fromSi, type Powder, type UserPowder, type UserRecord } from '@open-reloading/schema'
import web from '../../package.json'
import { fitStrings, type TuneString } from './powder-tune.ts'
import { userRef } from './variants.ts'

/** The record's names of the fitted parameters it can hold; the others stay in `fit.parameters` only. */
const recordFitted = { burnRate: 'vivacity', energy: 'energy' } as const

/** What the tuning screen saves a fit from. */
interface FittedPowderInput {
  fit: PowderFit
  confidence: PowderConfidence
  /** The strings of the fit, one point each. */
  strings: readonly TuneString[]
  /** The powder of the workbench's run: its fields besides the burn law stay, and its bore-resistance law. */
  base?: Powder | undefined
  /** The ids of the stored sessions the strings came from. */
  sessions: readonly string[]
  id: string
  name: string
  /** Time of the save, which is the time of the fit. */
  date: Date
}

/**
 * The user powder of a fit: the fitted load's burn law in stored units with the fitted values, the
 * base powder's other fields and the `fit` block. Undefined for a load whose burn law a powder
 * record cannot hold (no two-stage vivacity form).
 */
export function fittedPowder(
  f: FittedPowderInput,
): Extract<UserRecord, { kind: 'powder' }> | undefined {
  const { load, parameters } = f.fit
  const p = load.propellant
  const burn = p.burn
  if (burn.kind !== 'vivacity' || burn.form.kind !== 'twoStage') return
  const { a, m, q, z1 } = burn.form
  const u = (name: string) => parameters.find((x) => x.name === name)?.standardUncertainty
  const estimate = (value: number, name: string) => {
    const s = u(name)
    return s === undefined ? { value } : { value, standardUncertainty: s }
  }
  const pressure = (pa: number) => ({ value: fromSi('pressure', pa) })
  const {
    id: _id,
    manufacturer: _m,
    name: _n,
    country: _c,
    provenance: _p,
    temperatureSensitivity: _t,
    interior: baseInterior,
    ...fields
  } = f.base ?? ({} as Partial<Powder>)
  const fitted = parameters.flatMap((x) =>
    x.name === 'burnRate' || x.name === 'energy' ? [recordFitted[x.name]] : [],
  )
  const draft: NonNullable<UserPowder['draft']> = {
    // a draft field is absent, never undefined
    ...(Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined)) as Omit<
      NonNullable<UserPowder['draft']>,
      'interior'
    >),
    interior: {
      model: 'm3',
      fitted,
      vivacity: estimate(burn.vivacity, 'burnRate'),
      energy: estimate(p.specificEnergy, 'energy'),
      gamma: p.gamma,
      covolume: { value: fromSi('specificVolume', p.covolume) },
      density: { value: fromSi('density', p.density) },
      pressureExponent: burn.exponent,
      referencePressure: pressure(burn.referencePressure),
      ignitionPressure: pressure(load.ignitionPressure),
      startPressure: pressure(load.startPressure),
      propellantTemperature: { value: fromSi('temperature', load.propellantTemperature) },
      burnForm: { kind: 'twoStage', a: { value: a }, m, q, z1 },
      ...(baseInterior?.resistance && { resistance: baseInterior.resistance }),
    },
  }
  return {
    kind: 'powder',
    id: f.id,
    name: f.name,
    saved: f.date.toISOString(),
    data: {
      origin: 'user',
      provenanceKind: 'fitted',
      draft,
      fit: {
        input: fitStrings(f.strings).map((s) => ({
          charge: { value: fromSi('mass', s.charge) },
          muzzleVelocity: { value: s.velocities.reduce((a, x) => a + x, 0) / s.velocities.length },
          shots: s.velocities.length,
          barrelLength: { value: fromSi('length', load.barrel.length) },
          temperature: { value: fromSi('temperature', load.propellantTemperature) },
          caseCapacity: { value: fromSi('volume', load.chamber.volume) },
          bulletMass: { value: fromSi('mass', load.bullet.mass) },
        })),
        parameters: parameters.map((x) => x.name),
        options: { loss: { kind: 'quadratic' } },
        date: f.date.toISOString(),
        model: 'm3',
        modelVersion: web.version,
        confidence: f.confidence.label,
        reasons: [...f.confidence.reasons],
        // a reference names a UUID: a session of an older id is left out
        sessions: f.sessions.flatMap((s) => userRef(s) ?? []),
      },
    },
  }
}
