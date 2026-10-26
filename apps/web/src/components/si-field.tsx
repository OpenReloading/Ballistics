'use client'

import { useState } from 'react'
import { type FieldSpec, type FieldValue, fieldError } from '../lib/field-spec.ts'
import { formatQuantity, roundedFieldText } from '../lib/units.ts'
import { NumberField } from './number-field.tsx'
import { useUnits } from './units-settings.tsx'

/**
 * A number field on an SI value: the typed text while editing, the value's text otherwise. A valid
 * entry commits on each keystroke, or with `deferred` when the field is left or on Enter; an empty
 * required field never commits.
 */
export function SiField({
  spec,
  si,
  onCommit,
  placeholder,
  shown,
  deferred,
}: {
  spec: FieldSpec
  si: number | undefined
  onCommit: (si: number | undefined) => void
  placeholder?: string | undefined
  /** A value shown before the placeholder text, SI. */
  shown?: number | undefined
  /** Commit when the field is left or on Enter, not on every keystroke. */
  deferred?: boolean
}) {
  const { system } = useUnits()
  const [draft, setDraft] = useState<FieldValue>()
  const commits = (v: FieldValue) =>
    !fieldError(spec, v, system) && (v.si !== undefined || !spec.required)
  const commit = () => {
    if (draft && commits(draft)) onCommit(draft.si)
    setDraft(undefined)
  }
  const value = draft ?? {
    text: si === undefined ? '' : roundedFieldText(spec.quantity, system, si),
    si,
  }
  return (
    <NumberField
      spec={spec}
      system={system}
      value={value}
      placeholder={
        shown === undefined
          ? placeholder
          : (s) => `${formatQuantity(spec.quantity, s, shown)} ${placeholder}`
      }
      error={draft && ((s) => fieldError(spec, draft, s))}
      onChange={(v) => {
        setDraft(v)
        if (!deferred && commits(v)) onCommit(v.si)
      }}
      onBlur={deferred ? commit : () => setDraft(undefined)}
      onEnter={deferred ? commit : undefined}
    />
  )
}
