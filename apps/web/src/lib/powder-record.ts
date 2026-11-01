import type { Powder, UserPowderFit } from '@open-reloading/schema'
import type { Translator } from '../i18n/translate.ts'
import { localDay } from './dates.ts'
import { interiorFields } from './interior-input.ts'
import { fixedFieldText, type UnitSystem } from './units.ts'

/**
 * A powder record's M3 parameters in the workbench: the fill, the field marks, the fit summary
 * and the bore resistance of the fit.
 */

/** A field value still equal to the record value `from`, within 1e-9 relative. */
const matchesRecordValue = (from: number, si: number | undefined) =>
  si !== undefined && Math.abs(si - from) <= 1e-9 * Math.abs(from)

/** Keys of the fields still holding the value a record filled (`origin`), not edited since. */
export const unchangedFromRecord = (
  origin: Record<string, number>,
  values: Record<string, number | undefined>,
) =>
  Object.entries(origin)
    .filter(([k, from]) => matchesRecordValue(from, values[k]))
    .map(([k]) => k)

type FittedKey = NonNullable<Powder['interior']>['fitted'][number]

/** The record's names of the fitted fields, by workbench field key. */
const fittedKey: Record<string, FittedKey> = {
  vivacity: 'vivacity',
  propellantEnergy: 'energy',
  formA: 'form.a',
}

/**
 * Whether a fitted field of `p` shows another value than the one the record filled (`origin`):
 * a typed value moved a fitted parameter. `shown` writes a field's SI value at its display
 * precision, so a value typed as shown is no move.
 */
const handTuned = (
  p: Powder,
  origin: Record<string, number>,
  values: Record<string, number | undefined>,
  shown: (key: string, si: number) => string,
) =>
  Object.entries(fittedKey).some(([key, name]) => {
    const from = origin[key]
    const si = values[key]
    return (
      p.interior?.fitted.includes(name) &&
      from !== undefined &&
      (si === undefined || shown(key, si) !== shown(key, from))
    )
  })

/**
 * The mark of a fitted powder: fitted to `strings` strings on the local day of `date`, an ISO time
 * (`day` writes that day, given as YYYY-MM-DD), or hand-tuned once a fitted value moved.
 */
export const fitMark = (
  strings: number,
  date: string,
  tuned: boolean,
  day: (iso: string) => string,
  { tn, t }: Pick<Translator, 't' | 'tn'>,
) =>
  tuned
    ? t('simulation parameters, hand-tuned')
    : tn(
        strings,
        'simulation parameters fitted to {count} string, {date}',
        'simulation parameters fitted to {count} strings, {date}',
        { date: day(localDay(new Date(date))) },
      )

/**
 * The fit mark of the workbench's powder `design` against the record values it filled (`origin`)
 * and the SI field values, compared as the fields write them in `s`; undefined for a powder not
 * saved from a fit.
 */
export function loadFitMark(
  design: { powder: Powder; fit?: UserPowderFit | undefined } | undefined,
  origin: Record<string, number> | undefined,
  values: Record<string, number | undefined>,
  s: UnitSystem,
  day: (iso: string) => string,
  tr: Pick<Translator, 't' | 'tn'>,
) {
  if (!design?.fit || !origin) return
  const shown = (key: string, si: number) => {
    const spec = interiorFields.find((f) => f.key === key)
    return spec ? fixedFieldText(spec.quantity, s, si) : `${si}`
  }
  const tuned = handTuned(design.powder, origin, values, shown)
  return fitMark(design.fit.input.length, design.fit.date, tuned, day, tr)
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
  /** Where the values come from. */
  source: 'record' | 'user design',
  t: Translator['t'],
  /** The mark of a powder saved from a fit (`fitMark`), which its fitted fields carry. */
  fit?: string | undefined,
) {
  const from = origin[key]
  if (from === undefined) return
  const fitted = p.interior?.fitted.some((k) => k === fittedKey[key])
  if (fitted && fit) return t('From the user design: {mark}.', { mark: fit })
  if (matchesRecordValue(from, si)) {
    if (source === 'record')
      return fitted ? t('From the record (fitted).') : t('From the record (input of the fit).')
    return fitted
      ? t('From the user design (fitted).')
      : t('From the user design (input of the fit).')
  }
  const value = shown(from)
  return source === 'record'
    ? t('Changed from the record value {value}.', { value })
    : t('Changed from the user design value {value}.', { value })
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
