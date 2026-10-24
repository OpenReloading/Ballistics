import { defaultStartPressure, handgunBarrelLengthLimit } from '@openreloading/core'
import { type Powder, toSi } from '@openreloading/schema'

/**
 * A powder record's M3 parameters in the workbench: the fill, the field marks, the fit summary
 * and the bore resistance of the fit.
 */

/** SI field values of the record's model parameters; undefined for a record without them. */
export function powderModelValues(p: Powder): Record<string, number> | undefined {
  const i = p.interior
  if (!i) return undefined
  return {
    propellantEnergy: i.energy.value,
    gamma: i.gamma,
    density: toSi('density', i.density.value),
    covolume: i.covolume.value,
    vivacity: i.vivacity.value,
    exponent: i.pressureExponent,
    referencePressure: toSi('pressure', i.referencePressure.value),
    ignitionPressure: toSi('pressure', i.ignitionPressure.value),
    // without its own value each load had the rule's default: the one from 300 mm, as the workbench has no barrel length
    startPressure: i.startPressure
      ? toSi('pressure', i.startPressure.value)
      : defaultStartPressure(handgunBarrelLengthLimit).value,
    formA: i.burnForm.a.value,
    formM: i.burnForm.m,
    formQ: i.burnForm.q,
    formZ1: i.burnForm.z1,
  }
}

/** A field value still equal to the record value `from`, within 1e-9 relative. */
const matchesRecordValue = (from: number, si: number | undefined) =>
  si !== undefined && Math.abs(si - from) <= 1e-9 * Math.abs(from)

/** Keys of the fields still holding the value a record filled (`origin`), not edited since. */
export const unchangedFromRecord = (
  origin: Record<string, number>,
  values: Record<string, number | undefined>,
) => Object.keys(origin).filter((k) => matchesRecordValue(origin[k], values[k]))

type FittedKey = NonNullable<Powder['interior']>['fitted'][number]

/** The record's names of the fitted fields, by workbench field key. */
const fittedKey: Record<string, FittedKey> = {
  vivacity: 'vivacity',
  propellantEnergy: 'energy',
  formA: 'form.a',
}

/**
 * A field's mark against the filled record values `origin`: from the record (fitted or an input of
 * the fit), or changed from the record value; undefined for a field the record does not fill.
 */
export function recordMark(
  p: Powder,
  origin: Record<string, number>,
  key: string,
  si: number | undefined,
  shown: (si: number) => string,
) {
  const from = origin[key]
  if (from === undefined) return
  if (matchesRecordValue(from, si) && key === 'startPressure' && !p.interior?.startPressure)
    return "From the fit's start pressure rule for barrels of 300 mm and longer."
  if (matchesRecordValue(from, si))
    return `From the record (${p.interior?.fitted.includes(fittedKey[key]) ? 'fitted' : 'input of the fit'}).`
  return `Changed from the record value ${shown(from)}.`
}

/**
 * Plausibility of the fitted energy: fitted over the thermochemistry energy, impetus / (gamma - 1),
 * at the record's mean composition; undefined without thermochemistry or a fit.
 */
export function fittedEnergyRatio(p: Powder) {
  const t = p.thermochemistry
  if (!t || !p.interior || !(t.gamma.value > 1)) return
  return p.interior.energy.value / (t.impetus.value / (t.gamma.value - 1))
}

/** One load table of a record's fit: title, training rows and cartridges. */
interface FitTable {
  title: string
  trainingRows?: number
  trainingCartridges?: number
}

/** The fitted sources of a record with their training rows. */
export function fitTables(p: Powder): FitTable[] {
  return p.provenance.sources
    .filter(
      (s) =>
        (s.kind ?? p.provenance.kind) === 'fitted' && (!s.fields || s.fields.includes('interior')),
    )
    .map((s, _, all) => {
      const rows = /^(\d+) training rows/.exec(s.note ?? '')?.[1]
      // one table: the record's own count of the fit's rows and cartridges
      const own = all.length === 1 ? p.interior : undefined
      return {
        title: s.title,
        ...(rows
          ? { trainingRows: Number(rows) }
          : own?.trainingRows !== undefined && { trainingRows: own.trainingRows }),
        ...(own?.trainingCartridges !== undefined && {
          trainingCartridges: own.trainingCartridges,
        }),
      }
    })
}
