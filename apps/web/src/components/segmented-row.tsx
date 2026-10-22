'use client'

import { Tooltip } from '@mantine/core'
import { tipEvents } from '../lib/theme.ts'

/** One choice of a `SegmentedRow`; with a `reason` it is unavailable. */
export interface Segment<T extends string> {
  value: T
  label: string
  reason?: string
}

/**
 * A row of equal segments over native radios, so the arrow keys move the choice. An unavailable
 * segment stays focusable and shows its reason on hover, focus and touch.
 */
export function SegmentedRow<T extends string>({
  legend,
  name,
  value,
  segments,
  onChange,
}: {
  /** The group's name for screen readers. */
  legend: string
  name: string
  value: T
  segments: readonly Segment<T>[]
  onChange: (value: T) => void
}) {
  return (
    <div className="segmented-row">
      <fieldset>
        <legend className="visually-hidden">{legend}</legend>
        {segments.map((s) => {
          const choice = (
            <label key={s.value} data-unavailable={s.reason ? '' : undefined}>
              <input
                type="radio"
                name={name}
                value={s.value}
                checked={value === s.value}
                aria-disabled={s.reason ? true : undefined}
                aria-description={s.reason}
                onChange={() => {
                  if (!s.reason) onChange(s.value)
                }}
              />
              <span>{s.label}</span>
            </label>
          )
          return s.reason ? (
            <Tooltip key={s.value} label={s.reason} multiline maw={280} events={tipEvents}>
              {choice}
            </Tooltip>
          ) : (
            choice
          )
        })}
      </fieldset>
    </div>
  )
}
