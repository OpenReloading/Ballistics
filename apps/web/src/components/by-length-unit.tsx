'use client'

import type { ReactNode } from 'react'
import { localizeDecimals } from '../i18n/number.ts'
import { drawingLengthUnit } from '../lib/units.ts'
import { useUnits } from './units-settings.tsx'

/**
 * A server-rendered figure in the Settings length unit: the server lays out both, the page shows
 * one (mm until the stored choice is read, as every value on the page).
 */
export function ByLengthUnit({ mm, inch }: { mm: ReactNode; inch: ReactNode }) {
  const { system } = useUnits()
  const shown = drawingLengthUnit(system) === 'in' ? inch : mm
  // the server wrote the numbers with a point
  return typeof shown === 'string' ? localizeDecimals(shown) : shown
}
