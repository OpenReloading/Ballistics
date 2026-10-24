'use client'

import { Select } from '@mantine/core'
import { toSi } from '@open-reloading/schema'
import { useMemo } from 'react'
import { caliberDiameters, caliberOptions } from '../lib/caliber.ts'
import { controlSize } from '../lib/theme.ts'
import { formatNumber, inchText } from '../lib/units.ts'
import { useUnits } from './units-settings.tsx'

/**
 * The caliber filter of the cartridge and bullet lists: the common calibers first, each option
 * with its count and, at the right, its diameter in the Settings length unit unless the name
 * already gives that value.
 */
export function CaliberSelect({
  className,
  diameters,
  value,
  onChange,
}: {
  /** `more-filter`: behind "More filters" on a phone. */
  className?: string
  /** Every cartridge's G1 or bullet's diameter, mm. */
  diameters: readonly number[]
  value: string
  onChange: (caliber: string) => void
}) {
  const { system } = useUnits()
  const options = useMemo(() => caliberOptions(diameters), [diameters])
  const common = useMemo(() => caliberDiameters(diameters), [diameters])
  const { symbol } = system.length
  const diameter = (name: string) => {
    const mm = common.get(name)
    if (mm === undefined) return ''
    const text = inchText(
      formatNumber(system.length.fromSi(toSi('length', mm)), symbol === 'in' ? 3 : 2),
      symbol,
    )
    // the name already says it when its own value is in the Settings unit and equals the diameter
    const own = name.endsWith(' mm') ? ['mm', name.slice(0, -3)] : ['in', name]
    return own[0] === symbol && Number(own[1]) === Number(text) ? '' : `${text} ${symbol}`
  }
  return (
    <Select
      className={className}
      aria-label="Caliber"
      placeholder="Caliber"
      size={controlSize.row.input}
      searchable
      clearable
      data={options}
      comboboxProps={{ width: 'max-content', position: 'bottom-start' }}
      value={value || null}
      onChange={(v) => onChange(v ?? '')}
      renderOption={({ option }) => (
        <span className="caliber-option">
          <span>{option.label}</span>
          <span className="caliber-diameter">{diameter(option.value)}</span>
        </span>
      )}
    />
  )
}
