import type { Icon } from '@phosphor-icons/react'
import type { ReactNode } from 'react'
import { presetUnits } from '../lib/units.ts'
import { Noted } from './field-table.tsx'

/** The two unit systems a value can show: a tolerance slot, a fact and a matrix cell fit the longer text, so a unit change moves nothing. */
export const slotUnits = [presetUnits('metric-grams'), presetUnits('us')]

/**
 * A text that takes the room of its longest form: the visible one and the same fact in the metric
 * and in the US system, drawn as hidden pseudo-element text (`data-a`, `data-b`: no height, not in
 * the document text), so the preset applying after mounting, or a switch, moves nothing.
 */
export function Sized({ now, also }: { now: ReactNode; also: string[] }) {
  return (
    <span className="sized" data-a={also[0]} data-b={also[1]}>
      <span>{now}</span>
    </span>
  )
}

/** A symbol or label with its notes on hover, focus and touch; plain without notes. */
export function Label({ text, notes }: { text: string; notes: string[] }) {
  return notes.length > 0 ? <Noted value={text} notes={notes} inline /> : text
}

/** One fact: a label (its meaning on hover where known) with its unit, over its value. */
export function Fact({
  label,
  notes = [],
  lead,
  unit,
  children,
}: {
  label: string
  notes?: string[]
  /** The most important value of its card, set larger. */
  lead?: boolean
  /** The unit after the label, as a table head has it (and printed after the value). */
  unit?: { now: string; also: string[] }
  children: ReactNode
}) {
  return (
    <div className={lead ? 'fact fact-lead' : 'fact'}>
      <dt>
        <Label text={label} notes={notes} />
        {unit && unit.now + unit.also.join('') !== '' && (
          <>
            {' '}
            <span className="fact-unit">
              <Sized now={unit.now} also={unit.also} />
            </span>
          </>
        )}
      </dt>
      <dd data-unit={unit?.now || undefined}>{children}</dd>
    </div>
  )
}

/** A card of facts with a leading icon. */
export function FactCard({ icon: Glyph, children }: { icon: Icon; children: ReactNode }) {
  return (
    <div className="fact-card">
      <Glyph aria-hidden="true" className="fact-icon" />
      <dl className="fact-list">{children}</dl>
    </div>
  )
}

/** The fact cards under a record's page bar, then `children` (the record's controls). */
export function FactCards({ children }: { children: ReactNode }) {
  return <div className="fact-cards">{children}</div>
}
