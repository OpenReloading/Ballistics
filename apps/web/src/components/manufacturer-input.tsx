'use client'

import { Autocomplete } from '@mantine/core'
import { memo, useState } from 'react'
import type { useManufacturers } from './use-manufacturers.ts'

/**
 * A manufacturer field: the typed text is matched to a catalogue or user manufacturer when the
 * field is left or an option is chosen, and a name nobody has becomes a new user manufacturer
 * (`ensure`). `value` and `onChange` are the reference (`catalogue:<id>` or `user:<id>`).
 */
export const ManufacturerInput = memo(function ManufacturerInput({
  label,
  value,
  onChange,
  manufacturers: { known, ensure, nameOf },
}: {
  label: string
  value: string | undefined
  onChange: (ref: string | undefined) => void
  manufacturers: ReturnType<typeof useManufacturers>
}) {
  // undefined: not being edited, the field shows the name of `value`
  const [typed, setTyped] = useState<string>()
  const commit = (text: string) => {
    setTyped(undefined)
    const ref = ensure(text)
    if (ref !== value) onChange(ref)
  }
  return (
    <Autocomplete
      label={label}
      maxLength={200}
      value={typed ?? nameOf(value)}
      data={[...new Set(known.map((m) => m.name))]}
      limit={20}
      onChange={setTyped}
      onOptionSubmit={commit}
      onBlur={() => typed !== undefined && commit(typed)}
    />
  )
})
