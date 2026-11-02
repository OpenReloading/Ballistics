'use client'

import { Autocomplete } from '@mantine/core'
import { memo, useRef, useState } from 'react'
import { useTranslation } from '../i18n/language.ts'
import type { useManufacturers } from './use-manufacturers.ts'

/**
 * A manufacturer field. `value` and `onChange` are the reference (`catalogue:<id>` or
 * `user:<id>`), reported with every keystroke so a save never lags the text: the manufacturer the
 * text names, else the reference of a new user manufacturer whose id is chosen when typing starts.
 * The record of a new one is stored when the field is left, an option is chosen or a save
 * shortcut is pressed in it, and the next typed name finds it. While the catalogue has not
 * answered, leaving the field asks it again; a name it cannot check gets no reference and the field
 * says so.
 */
export const ManufacturerInput = memo(function ManufacturerInput({
  label,
  value,
  onChange,
  manufacturers: { known, ready, retry, preview, ensure, newId, nameOf },
}: {
  label: string
  value: string | undefined
  onChange: (ref: string | undefined) => void
  manufacturers: ReturnType<typeof useManufacturers>
}) {
  const { t } = useTranslation()
  // undefined: not being edited, the field shows the name of `value`
  const [typed, setTyped] = useState<string>()
  const pending = useRef<string>(undefined)
  // Mantine calls onChange with the option's text right after onOptionSubmit
  const picked = useRef(false)
  const report = (text: string) => {
    latestText.current = text
    pending.current ??= newId()
    const ref = preview(text, pending.current)
    if (ref !== value) onChange(ref)
  }
  const [unchecked, setUnchecked] = useState(false)
  const latestText = useRef('')
  const commit = async (text: string) => {
    latestText.current = text
    // the catalogue may have the name: ask it before a new user manufacturer is made
    if (!ready && text.trim() !== '') {
      await retry()
      // typed on meanwhile: the new text commits when the field is left
      if (latestText.current !== text) return
    }
    pending.current ??= newId()
    const ref = ensure(text, pending.current)
    pending.current = undefined
    // the typed text stays on screen, with the reason, until it is changed
    const kept = ref === undefined && text.trim() !== ''
    setUnchecked(kept)
    if (!kept) setTyped(undefined)
    if (ref !== value) onChange(ref)
  }
  return (
    <Autocomplete
      label={label}
      maxLength={200}
      value={typed ?? nameOf(value)}
      error={
        unchecked
          ? t(
              'The manufacturer list cannot be read, so this name is not kept. Try again when it loads.',
            )
          : undefined
      }
      data={[...new Set(known.map((m) => m.name))]}
      limit={20}
      onChange={(text) => {
        if (picked.current) return
        setUnchecked(false)
        setTyped(text)
        report(text)
      }}
      onOptionSubmit={(text) => {
        picked.current = true
        queueMicrotask(() => {
          picked.current = false
        })
        void commit(text)
      }}
      // the save shortcut works inside fields: the record goes into the store before the save does
      onKeyDown={(e) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's' && typed !== undefined)
          void commit(typed)
      }}
      onBlur={() => typed !== undefined && commit(typed)}
    />
  )
})
