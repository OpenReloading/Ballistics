import { useMemo, useState } from 'react'
import type { Fields } from '../lib/field-spec.ts'
import { specFields } from '../lib/interior-input.ts'
import { effectiveSpecValues, recordSpecValues, type SpecValues } from '../lib/record-specs.ts'
import { fixedFieldText, type UnitSystem } from '../lib/units.ts'
import { useFieldUnits } from './units-settings.tsx'

/** `record` in SI, `typed` kept while edited (also empty), `values` the records' then the typed ones, one object while its numbers do; records give Pmax in bar, L3 in mm, bulk density in g/cm3, `bulkDensity` in kg/m3. */
export function useSpecValues(
  system: UnitSystem,
  given: {
    pmax: number | undefined
    caseLength: number | undefined
    bulkDensity: number | undefined
  },
) {
  const [typed, setTyped] = useState<Fields>({})
  useFieldUnits(specFields, system, (update) => setTyped((f) => update(f)), fixedFieldText)
  const { pmax, caseLength, bulkDensity } = given
  const record = useMemo(
    () => recordSpecValues({ pmax, caseLength, bulkDensity }),
    [pmax, caseLength, bulkDensity],
  )
  const key = JSON.stringify(effectiveSpecValues(record, typed))
  const values = useMemo(() => JSON.parse(key) as SpecValues, [key])
  /** Drops the typed values of `keys`: the fields show the records' values again. */
  const unset = (keys: readonly string[]) =>
    setTyped((f) => Object.fromEntries(Object.entries(f).filter(([k]) => !keys.includes(k))))
  return { typed, setTyped, record, values, unset }
}
