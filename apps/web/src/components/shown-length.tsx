import { toSi } from '@open-reloading/schema'
import { presetUnits, withUnit } from '../lib/units.ts'
import { ByLengthUnit } from './by-length-unit.tsx'

/** A length in mm as a value in the Settings length unit. */
export const shownLength = (mm: number) => (
  <ByLengthUnit
    mm={withUnit('length', presetUnits('metric-grams'), toSi('length', mm))}
    inch={withUnit('length', presetUnits('us'), toSi('length', mm))}
  />
)
