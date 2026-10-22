'use client'

import { NumberInput } from '@mantine/core'
import { controlSize } from '../lib/theme.ts'
import { ExtraField } from './directory-table.tsx'

/**
 * A from-to pair of number fields behind one URL text ("7-8mm", "0.2-0.3") in the "More filters" popover.
 * `range` is the parsed text; a bound kept in another unit than `unit` shows converted.
 */
export function RangeFilter({
  label,
  unit,
  range,
  convert,
  integer,
  onChange,
}: {
  label: string
  /** The Settings unit of the fields; empty for a number without a unit. */
  unit: string
  range: { min?: number; max?: number; unit: string } | undefined
  convert?: (x: number, from: string, to: string) => number
  integer?: boolean
  onChange: (text: string) => void
}) {
  const shown = (x: number | undefined) =>
    x === undefined || !range
      ? ''
      : range.unit === unit || !convert
        ? x
        : convert(x, range.unit, unit)
  const [from, to] = [shown(range?.min), shown(range?.max)]
  const set = (min: number | string, max: number | string) =>
    onChange(min === '' && max === '' ? '' : `${min}-${max}${unit}`)
  const field = (
    name: 'from' | 'to',
    value: number | string,
    apply: (v: number | string) => void,
  ) => (
    <NumberInput
      className="directory-number"
      aria-label={`${label} ${name}${unit ? ` (${unit})` : ''}`}
      placeholder={name === 'from' ? 'From…' : 'To…'}
      size={controlSize.row.input}
      min={0}
      allowNegative={false}
      allowDecimal={!integer}
      hideControls
      value={value}
      onChange={apply}
    />
  )
  return (
    <ExtraField label={label}>
      <fieldset className="range-filter" aria-label={label}>
        {field('from', from, (v) => set(v, to))}
        {field('to', to, (v) => set(from, v))}
        <span className="range-unit" aria-hidden="true">
          {unit}
        </span>
      </fieldset>
    </ExtraField>
  )
}
