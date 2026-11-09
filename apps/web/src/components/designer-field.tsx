'use client'

import { type CSSProperties, memo } from 'react'
import { useTranslation } from '../i18n/language.ts'
import type { FieldSpec, FieldValue } from '../lib/field-spec.ts'
import type { UnitSystem } from '../lib/units.ts'
import { type FieldFlag, NumberField } from './number-field.tsx'

/** The edit a designer field dispatches. */
type FieldAction = { type: 'field'; key: string; value: FieldValue }

/** The field's value back to that of the record the design started from. */
type RevertAction = { type: 'revert'; key: string; system: UnitSystem }

/** The `revert` of a design's fields: the designer's dispatch while the design started from a record. */
export const revertOf = <A,>(design: { origin?: unknown }, dispatch: A) =>
  design.origin === undefined ? undefined : dispatch

/** No slider (arrow keys step), the state a flag on the input's edge and its description; memoized on plain props, so a change re-renders only the fields whose text or state changed. */
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
  revert,
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
  /** `switch` toggles this field to the quantity's other unit (the messages keep naming their own); `none` where the grid's column header names the unit. */
  unit?: 'switch' | 'text' | 'none' | undefined
  /** The drawing's symbol of the value, shown before the label; focus marks it in the drawing. */
  symbol?: string | undefined
  /** Given while the design started from a record, so a changed value's flag reverts it; the designer's dispatch, stable for the memo. */
  revert?: ((a: RevertAction) => void) | undefined
  dispatch: (a: FieldAction) => void
}) {
  const { t } = useTranslation()
  // the label's title is the help, the flag's tooltip the error while it applies; screen readers hear both, each as its own sentence
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
        // the tooltip keeps the help, which names the record's value
        action={
          revert && changed && !error
            ? {
                kind: 'restore',
                text: `${t('Back to the record value.')} ${help}`,
                // the click's target finds the field, also where a click does not focus the button (Safari, Firefox on macOS)
                onClick: (e?: { currentTarget: Element }) => {
                  // the button goes with the change: the field keeps the focus
                  const input = (e?.currentTarget ?? document.activeElement)
                    ?.closest('.designer-field')
                    ?.querySelector<HTMLInputElement>('input')
                  revert({ type: 'revert', key: spec.key, system })
                  input?.focus()
                },
              }
            : undefined
        }
        onChange={(v) => dispatch({ type: 'field', key: spec.key, value: v })}
      />
    </div>
  )
})
