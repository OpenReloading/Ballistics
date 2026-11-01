'use client'

import { type CSSProperties, memo } from 'react'
import type { FieldSpec, FieldValue } from '../lib/field-spec.ts'
import type { UnitSystem } from '../lib/units.ts'
import { type FieldFlag, NumberField } from './number-field.tsx'

/** The edit a designer field dispatches. */
type FieldAction = { type: 'field'; key: string; value: FieldValue }

/**
 * A number field of a designer's property grid: no slider (arrow keys step the value), the
 * state as a flag on the input's edge and as its description; memoized on plain props, so a change
 * re-renders only the fields whose text or state changed.
 */
export const DesignerField = memo(function DesignerField({
  spec,
  system,
  value,
  help,
  flag,
  changed,
  error,
  unit = 'text',
  symbol,
  dispatch,
}: {
  spec: FieldSpec
  system: UnitSystem
  value: FieldValue
  help: string
  /** The state's flag kind; an error flags the field whatever its state. */
  flag?: FieldFlag['kind'] | undefined
  changed: boolean
  error?: string | undefined
  /** `none` where the grid's column header names the unit. */
  unit?: 'text' | 'none' | undefined
  /** The drawing's symbol of the value, shown before the label; focus marks it in the drawing. */
  symbol?: string | undefined
  dispatch: (a: FieldAction) => void
}) {
  // the error and the help stay apart: the label's title is the help, the flag's tooltip the error
  // while it applies, and the description for screen readers says both, each as its own sentence
  const marker = error
    ? { kind: 'exceeded' as const, text: error }
    : flag && { kind: flag, text: help }
  return (
    <div
      className="designer-field"
      data-changed={changed || undefined}
      data-error={error ? true : undefined}
      data-symbol={symbol}
      // read by the label's ::before (globals.css)
      style={symbol ? ({ '--symbol': `"${symbol}"` } as CSSProperties) : undefined}
    >
      <NumberField
        spec={{ ...spec, help }}
        system={system}
        value={value}
        error={!!error}
        unit={unit}
        flag={marker}
        onChange={(v) => dispatch({ type: 'field', key: spec.key, value: v })}
      />
    </div>
  )
})
