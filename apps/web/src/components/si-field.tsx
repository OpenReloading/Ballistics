import { useLingui } from '@lingui/react'
import { useState } from 'react'
import { useTranslation } from '../i18n/language.ts'
import { fieldError } from '../lib/field-error.ts'
import type { FieldSpec, FieldValue } from '../lib/field-spec.ts'
import { formatQuantity, roundedFieldText } from '../lib/units.ts'
import { NumberField } from './number-field.tsx'
import { useUnits } from './units-settings.tsx'

/** A valid entry commits on each keystroke, or with `deferred` when the field is left or on Enter; an empty required field never commits. */
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
  const { t } = useTranslation()
  const { i18n } = useLingui()
  const [draft, setDraft] = useState<FieldValue>()
  const commits = (v: FieldValue) =>
    !fieldError(spec, v, system, t, i18n) && (v.si !== undefined || !spec.required)
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
      error={draft && ((s) => fieldError(spec, draft, s, t, i18n))}
      onChange={(v) => {
        setDraft(v)
        if (!deferred && commits(v)) onCommit(v.si)
      }}
      onBlur={deferred ? commit : () => setDraft(undefined)}
      onEnter={deferred ? commit : undefined}
    />
  )
}
