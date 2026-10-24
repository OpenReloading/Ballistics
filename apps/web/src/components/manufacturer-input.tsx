'use client'

import { Autocomplete } from '@mantine/core'
import { memo, useRef, useState } from 'react'
import type { useManufacturers } from './use-manufacturers.ts'

/**
 * A manufacturer field. `value` and `onChange` are the reference (`catalogue:<id>` or
 * `user:<id>`), reported with every keystroke so a save never lags the text: the manufacturer the
 * text names, else the reference of a new user manufacturer whose id is chosen when typing starts.
 * The record of a new one is stored when the field is left or an option is chosen, and the next
 * typed name finds it.
 */
export const ManufacturerInput = memo(function ManufacturerInput({
  label,
  value,
  onChange,
  manufacturers: { known, preview, ensure, newId, nameOf },
}: {
  label: string
  value: string | undefined
  onChange: (ref: string | undefined) => void
  manufacturers: ReturnType<typeof useManufacturers>
}) {
  // undefined: not being edited, the field shows the name of `value`
  const [typed, setTyped] = useState<string>()
  const pending = useRef<string>(undefined)
  const report = (text: string) => {
    pending.current ??= newId()
    const ref = preview(text, pending.current)
    if (ref !== value) onChange(ref)
  }
  const commit = (text: string) => {
    setTyped(undefined)
    pending.current ??= newId()
    const ref = ensure(text, pending.current)
    pending.current = undefined
    if (ref !== value) onChange(ref)
  }
  return (
    <Autocomplete
      label={label}
      maxLength={200}
      value={typed ?? nameOf(value)}
      data={[...new Set(known.map((m) => m.name))]}
      limit={20}
      onChange={(text) => {
        setTyped(text)
        report(text)
      }}
      onOptionSubmit={commit}
      onBlur={() => typed !== undefined && commit(typed)}
    />
  )
})
