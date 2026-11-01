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
  unit = 'switch',
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
  /**
   * The unit suffix: a one-click switch of this field to the quantity's other unit (the messages keep
   * naming their own unit), plain text, or `none` where the grid's column header names the unit.
   */
  unit?: 'switch' | 'text' | 'none' | undefined
  /** The drawing's symbol of the value, shown before the label; focus marks it in the drawing. */
  symbol?: string | undefined
  dispatch: (a: FieldAction) => void
}) {
  // the message leads the help: the description, the label's title and the flag's tooltip
  const text = error ? `${error} ${help}` : help
  const kind = error ? 'exceeded' : flag
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
        spec={{ ...spec, help: text }}
        system={system}
        value={value}
        error={!!error}
        unit={unit}
        flag={kind && { kind, text }}
        onChange={(v) => dispatch({ type: 'field', key: spec.key, value: v })}
      />
    </div>
  )
})
