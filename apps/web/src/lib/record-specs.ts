import { fromSi, toSi } from '@open-reloading/schema'

/**
 * The values of the cartridge sheet and the powder record that the user may type over them, by
 * the keys of `analysis.overrides`: the Pmax (a limit the user types is theirs, no CIP value), the
 * case length L3 and the powder's bulk density.
 */
export const specValueKeys = ['pmax', 'caseLength', 'bulkDensity'] as const
export type SpecKey = (typeof specValueKeys)[number]

/** The values in SI (Pa, m, kg/m3); an absent key is a value no record gives and nobody typed. */
export type SpecValues = Partial<Record<SpecKey, number | undefined>>

/** The values the cartridge sheet (Pmax bar, L3 mm) and the powder (bulk density g/cm3) give, SI. */
export function recordSpecValues(a: {
  pmax: number | undefined
  caseLength: number | undefined
  bulkDensity: number | undefined
}): SpecValues {
  return {
    pmax: a.pmax === undefined ? undefined : toSi('pressure', a.pmax),
    caseLength: a.caseLength === undefined ? undefined : toSi('length', a.caseLength),
    bulkDensity: a.bulkDensity,
  }
}

/** The values a run reads: the records', each replaced by the typed one (`typed` holds the field values by key) above 0. */
export function effectiveSpecValues(
  record: SpecValues,
  typed: Record<string, { si: number | undefined }>,
): SpecValues {
  const out: SpecValues = { ...record }
  for (const key of specValueKeys) {
    const si = typed[key]?.si
    if (si !== undefined && si > 0) out[key] = si
  }
  return out
}

/** The typed value of `key`, SI: one that is above 0. */
export const typedSpec = (typed: Record<string, { si: number | undefined }>, key: SpecKey) =>
  effectiveSpecValues({}, typed)[key]

/** The case length L3 the user typed, mm; undefined while none is typed. */
export const typedCaseLength = (typed: Record<string, { si: number | undefined }>) => {
  const si = typedSpec(typed, 'caseLength')
  return si === undefined ? undefined : fromSi('length', si)
}

/** The Pmax a readout names, bar: SI Pa in, bar out. */
export const pmaxBar = (pa: number | undefined) =>
  pa === undefined ? undefined : fromSi('pressure', pa)
