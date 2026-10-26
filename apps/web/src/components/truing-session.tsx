'use client'

import { Button, Checkbox, NativeSelect, TextInput } from '@mantine/core'
import type { RangeStringFit, TrajectoryInput, TruingPlan } from '@open-reloading/core'
import { useState } from 'react'
import {
  type Attempt,
  blankChrono,
  blankRow,
  fitSession,
  nominalLine,
  type ParameterLine,
  parameterLabels,
  parameterLines,
  planSession,
  residualLines,
  type TruingChrono,
  type TruingRow,
} from '../lib/truing-session.ts'
import { roundedFieldText, type UnitSystem } from '../lib/units.ts'
import { PanelTable } from './scroll-region.tsx'

/** What the section reads from the Trajectory tab's result. */
export type TruingNominal = {
  shot: TrajectoryInput
  bullet: string
  zeroRange: number
  /** The chosen optic's click, rad. */
  click?: number | undefined
}

const startRows = () => [blankRow(), blankRow(), blankRow()]

/** An answer with the nominal shot it was made for: a later change of the shot hides it. */
type Shown<T> = { shot: TrajectoryInput; attempt: Attempt<T> }

function Statuses({ lines, fit }: { lines: ParameterLine[]; fit: boolean }) {
  return (
    <PanelTable
      label={fit ? 'Fitted parameters' : 'Planned parameters'}
      caption={fit ? 'Fitted parameters' : 'Parameters the planned string identifies'}
      columns={
        fit
          ? ['Parameter', 'Status', 'Value', 'Interval', 'Standard error']
          : ['Parameter', 'Status', 'Standard error', 'Interval around the nominal value']
      }
    >
      {lines.map((l) => (
        <tr key={l.name}>
          <th scope="row">{l.label}</th>
          <td>{l.statusText}</td>
          {fit && <td className="num">{l.value ?? 'No value'}</td>}
          {!fit && <td className="num">{l.error ?? '–'}</td>}
          <td className="num">{l.interval ?? '–'}</td>
          {fit && <td className="num">{l.error ?? '–'}</td>}
        </tr>
      ))}
    </PanelTable>
  )
}

/** The count line a screen reader hears when an answer arrives. */
const countText = (what: string, lines: ParameterLine[]) =>
  `${what}: ${lines.filter((l) => l.status === 'identified').length} of ${lines.length} parameters identified.`

/**
 * Truing from range strings: plan a string of distances before shooting, enter the measured
 * strings, and read muzzle velocity, drag factor and click value with their intervals
 * (`apps/docs/docs/models/exterior-truing-strings.md`). The nominal shot is the Trajectory tab's.
 * Nothing is stored.
 */
export function TruingSession({ nominal, system }: { nominal: TruingNominal; system: UnitSystem }) {
  const [rows, setRows] = useState<TruingRow[]>(startRows)
  const [chrono, setChrono] = useState<TruingChrono>(blankChrono)
  const [dispersion, setDispersion] = useState('')
  // typed text; until then the chosen optic's click in the shown unit
  const [typedClick, setTypedClick] = useState<string>()
  const [zeroOffset, setZeroOffset] = useState(false)
  const [plan, setPlan] = useState<Shown<TruingPlan>>()
  const [fit, setFit] = useState<Shown<RangeStringFit>>()
  const click =
    typedClick ??
    (nominal.click === undefined ? '' : roundedFieldText('correction', system, nominal.click))
  const inputs = { rows, chrono, click, dispersion, fitZeroOffset: zeroOffset, system }
  const symbol = system.correction.symbol
  const offset = system.lineOfSightOffset.symbol
  const edit = (change: () => void) => {
    change()
    setPlan(undefined)
    setFit(undefined)
  }
  const setRow = (i: number, patch: Partial<TruingRow>) =>
    edit(() => setRows((all) => all.map((r, k) => (k === i ? { ...r, ...patch } : r))))
  const setChronoField = (patch: Partial<TruingChrono>) =>
    edit(() => setChrono((c) => ({ ...c, ...patch })))
  const shown = <T,>(s: Shown<T> | undefined) => (s?.shot === nominal.shot ? s?.attempt : undefined)
  const planned = shown(plan)
  const fitted = shown(fit)
  const planLines =
    planned && 'answer' in planned ? parameterLines(planned.answer.parameters, system) : undefined
  const fitLines =
    fitted && 'answer' in fitted ? parameterLines(fitted.answer.parameters, system) : undefined
  const cell = (i: number, key: keyof TruingRow, name: string, unit: string) => (
    <TextInput
      aria-label={`${name}, row ${i + 1}${unit ? ` (${unit})` : ''}`}
      inputMode="decimal"
      value={rows[i]?.[key] ?? ''}
      onChange={(e) => setRow(i, { [key]: e.currentTarget.value })}
    />
  )
  return (
    <div className="truing-session">
      <p className="note">
        Nominal shot from the inputs above:{' '}
        {nominalLine(
          {
            bullet: nominal.bullet,
            muzzleVelocity: nominal.shot.muzzleVelocity,
            zeroRange: nominal.zeroRange,
          },
          system,
        )}
        . Impacts are taken at the zero setting.
      </p>
      <div className="truing-fields">
        <TextInput
          label={`Click value (${symbol})`}
          inputMode="decimal"
          value={click}
          onChange={(e) => edit(() => setTypedClick(e.currentTarget.value))}
        />
        <TextInput
          label={`Dispersion of one shot (${symbol})`}
          description="Plan only: the vertical spread of one shot."
          inputMode="decimal"
          value={dispersion}
          onChange={(e) => edit(() => setDispersion(e.currentTarget.value))}
        />
        <Checkbox
          label="Fit a zero offset"
          checked={zeroOffset}
          onChange={(e) => edit(() => setZeroOffset(e.currentTarget.checked))}
        />
      </div>
      <p className="note">
        Mean and deviation of an impact are its height above the line of sight in {offset}, of a
        dial in clicks.
      </p>
      <PanelTable
        label="Range string"
        className="truing-table"
        caption="Distances shot"
        columns={['Kind', 'Distance', 'Shots', 'Mean', 'Deviation of one shot']}
      >
        {rows.map((r, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: rows have no id and keep their order
          <tr key={i}>
            <td>
              <NativeSelect
                aria-label={`Kind, row ${i + 1}`}
                value={r.kind}
                data={[
                  { value: 'impact', label: 'Impact' },
                  { value: 'dial', label: 'Dial' },
                ]}
                onChange={(e) => setRow(i, { kind: e.currentTarget.value as TruingRow['kind'] })}
              />
            </td>
            <td>{cell(i, 'range', 'Distance', system.range.symbol)}</td>
            <td>{cell(i, 'shots', 'Shots', '')}</td>
            <td>{cell(i, 'mean', 'Mean', r.kind === 'impact' ? offset : 'clicks')}</td>
            <td>
              {cell(
                i,
                'deviation',
                'Deviation of one shot',
                r.kind === 'impact' ? offset : 'clicks',
              )}
            </td>
          </tr>
        ))}
      </PanelTable>
      <div className="truing-fields">
        {(
          [
            ['shots', 'Chronograph readings', ''],
            ['mean', 'Chronograph mean', ` (${system.velocity.symbol})`],
            ['deviation', 'Chronograph deviation', ` (${system.velocity.symbol})`],
          ] as const
        ).map(([key, name, unit]) => (
          <TextInput
            key={key}
            label={`${name}${unit}`}
            inputMode="decimal"
            value={chrono[key]}
            onChange={(e) => setChronoField({ [key]: e.currentTarget.value })}
          />
        ))}
      </div>
      <div className="truing-actions">
        <Button
          variant="default"
          onClick={() =>
            setPlan({ shot: nominal.shot, attempt: planSession(nominal.shot, inputs) })
          }
        >
          Plan
        </Button>
        <Button
          onClick={() => setFit({ shot: nominal.shot, attempt: fitSession(nominal.shot, inputs) })}
        >
          Fit
        </Button>
        <Button variant="subtle" onClick={() => edit(() => setRows((all) => [...all, blankRow()]))}>
          Add row
        </Button>
        <Button
          variant="subtle"
          disabled={rows.length <= 1}
          onClick={() => edit(() => setRows((all) => all.slice(0, -1)))}
        >
          Remove last row
        </Button>
      </div>
      <p role="status" className="visually-hidden">
        {planLines && countText('Plan', planLines)} {fitLines && countText('Fit', fitLines)}
      </p>
      {planned && 'problem' in planned && (
        <p role="alert" className="error-text">
          Plan: {planned.problem}
        </p>
      )}
      {planLines && <Statuses lines={planLines} fit={false} />}
      {fitted && 'problem' in fitted && (
        <p role="alert" className="error-text">
          Fit: {fitted.problem}
        </p>
      )}
      {fitted && 'answer' in fitted && fitLines && (
        <section aria-labelledby="truing-fit" className="truing-result">
          <h3 id="truing-fit">Fit result</h3>
          <Statuses lines={fitLines} fit />
          {residualLines(fitted.answer).map((t) => (
            <p key={t} className="note">
              {t}
            </p>
          ))}
          {fitted.answer.confounded.length > 0 && (
            <p className="note">
              Not separable from each other:{' '}
              {fitted.answer.confounded.map((n) => parameterLabels[n].toLowerCase()).join(', ')}.
              Add distances, a dial row or a chronograph.
            </p>
          )}
          <p className="note">Simulation, not load data.</p>
        </section>
      )}
    </div>
  )
}
