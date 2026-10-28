'use client'

import { toSi } from '@open-reloading/schema'
import { presetUnits, withUnit } from '../lib/units.ts'
import { ByLengthUnit } from './by-length-unit.tsx'

/** A length in mm in the Settings length unit. */
export function ShownLength({ mm }: { mm: number }) {
  return (
    <ByLengthUnit
      mm={withUnit('length', presetUnits('metric-grams'), toSi('length', mm))}
      inch={withUnit('length', presetUnits('us'), toSi('length', mm))}
    />
  )
}
