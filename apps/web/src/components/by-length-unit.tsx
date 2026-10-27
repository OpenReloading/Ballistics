'use client'

import type { ReactNode } from 'react'
import { drawingLengthUnit } from '../lib/units.ts'
import { useUnits } from './units-settings.tsx'

/**
 * A figure in the Settings length unit: both are given as elements and only the one in the unit is
 * rendered (mm until the stored choice is read, as every value on the page).
 */
export function ByLengthUnit({ mm, inch }: { mm: ReactNode; inch: ReactNode }) {
  const { system } = useUnits()
  return drawingLengthUnit(system) === 'in' ? inch : mm
}
