'use client'

import { Button, Checkbox, NativeSelect, TextInput } from '@mantine/core'
import type { RangeStringFit, TrajectoryInput, TruingPlan } from '@open-reloading/core'
import type { Truing } from '@open-reloading/schema'
import { useState } from 'react'
import { useTranslation } from '../i18n/language.ts'
import type { Translator } from '../i18n/translate.ts'
import { errorText } from '../lib/error-text.ts'
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
  type StoreRefusal,
  type TruingChrono,
  type TruingRow,
  truingEntry,
  truingLimits,
  withTruing,
} from '../lib/truing-session.ts'
import { roundedFieldText, type UnitSystem } from '../lib/units.ts'
import { updateRecord } from '../lib/user-store.ts'
import { PanelTable } from './scroll-region.tsx'

/** What the section reads from the Trajectory tab's result. */
export type TruingNominal = {
  shot: TrajectoryInput
  bullet: string
  zeroRange: number
  /** The chosen optic's click, rad. */
  click?: number | undefined
  /** The firearm configuration chosen in the tab, which a fit can be stored with. */
  target?: { record: string; config: string; label: string } | undefined
}

const startRows = () => [blankRow(), blankRow(), blankRow()]

/**
 * An answer with the nominal shot it was made for: a later change of the shot hides it. A problem
 * is text of the language it was made in (`t`), so it goes with a change of language.
 */
type Shown<T> = { shot: TrajectoryInput; t: Translator['t']; attempt: Attempt<T> }

function Statuses({ lines, fit }: { lines: ParameterLine[]; fit: boolean }) {
  const { t } = useTranslation()
  return (
    <PanelTable
      label={fit ? t('Fitted parameters') : t('Planned parameters')}
      caption={fit ? t('Fitted parameters') : t('Parameters the planned string identifies')}
      columns={
        fit
          ? [t('Parameter'), t('Status'), t('Value'), t('Interval'), t('Standard error')]
          : [
              t('Parameter'),
              t('Status'),
              t('Standard error'),
              t('Interval around the nominal value'),
            ]
      }
    >
      {lines.map((l) => (
        <tr key={l.name}>
          <th scope="row">{l.label}</th>
          <td>{l.statusText}</td>
          {fit && <td className="num">{l.value ?? t('No value')}</td>}
          {!fit && <td className="num">{l.error ?? '–'}</td>}
          <td className="num">{l.interval ?? '–'}</td>
          {fit && <td className="num">{l.error ?? '–'}</td>}
        </tr>
      ))}
    </PanelTable>
  )
}

/** How a store ended: stored, refused for a known reason, or failed with an error text. */
type StoreOutcome = 'stored' | StoreRefusal | { error: string }

/** Stores a fit with its strings in the chosen firearm configuration, on request. */
function StoreFit({
  fit,
  target,
  entry,
}: {
  fit: RangeStringFit
  target: TruingNominal['target']
  entry: () => Truing | 'rows' | 'shots'
}) {
  const { t } = useTranslation()
  /** The fit that was stored, or that failed to store. */
  const [stored, setStored] = useState<{ fit: RangeStringFit; outcome: StoreOutcome }>()
  // a second click before the write ends would append the same result twice
  const [pending, setPending] = useState(false)
  if (!target)
    return (
      <p className="note">
        {t('Choose a firearm and sight above to store the result with its strings.')}
      </p>
    )
  const store = () => {
    if (pending) return
    const end = (outcome: StoreOutcome) => {
      setPending(false)
      setStored({ fit, outcome })
    }
    setPending(true)
    try {
      const e = entry()
      if (typeof e === 'string') return end(e)
      let refused: StoreRefusal = 'missing'
      updateRecord(target.record, (raw) => {
        const written = withTruing(raw, target.config, e, new Date())
        if (typeof written !== 'string') return written
        refused = written
      }).then(
        (written) => end(written ? 'stored' : refused),
        (error) => end({ error: errorText(error) }),
      )
    } catch (error) {
      end({ error: errorText(error) })
    }
  }
  const done = stored?.fit === fit ? stored.outcome : undefined
  const text = (outcome: StoreOutcome) => {
    if (typeof outcome === 'object')
      return t(
        'Not stored: the browser store refused it. {reason} Free browser storage and try again.',
        { reason: outcome.error },
      )
    switch (outcome) {
      case 'stored':
        return t('Stored with {configuration}, with its strings.', { configuration: target.label })
      case 'missing':
        return t(
          'Not stored: the firearm or its configuration is no longer in the library. Choose a firearm and sight above.',
        )
      case 'full':
        return t(
          'Not stored: {configuration} already holds {n} truing results. Remove an older result of it in the library.',
          { configuration: target.label, n: truingLimits.results },
        )
      case 'rows':
        return t('Not stored: a stored result keeps at most {n} rows. Remove rows and fit again.', {
          n: truingLimits.rows,
        })
      case 'shots':
        return t(
          'Not stored: a stored result keeps at most {n} shots in a row or the chronograph. Enter fewer shots and fit again.',
          { n: truingLimits.shots },
        )
    }
  }
  return (
    <>
      <Button variant="default" disabled={pending || done === 'stored'} onClick={store}>
        {t('Store with {configuration}', { configuration: target.label })}
      </Button>
      <p role="status" className="note">
        {done && text(done)}
      </p>
    </>
  )
}

/** The count line a screen reader hears when an answer arrives. */
const countText = (what: string, lines: ParameterLine[], t: Translator['t']) =>
  t('{what}: {n} of {total} parameters identified.', {
    what,
    n: lines.filter((l) => l.status === 'identified').length,
    total: lines.length,
  })

/**
 * Truing from range strings: plan a string of distances before shooting, enter the measured
 * strings, and read muzzle velocity, drag factor and click value with their intervals
 * (`apps/docs/docs/models/exterior-truing-strings.md`). The nominal shot is the Trajectory tab's.
 * A fit is stored only on request, with the strings, in the chosen firearm configuration; nothing
 * else is kept.
 */
export function TruingSession({ nominal, system }: { nominal: TruingNominal; system: UnitSystem }) {
  const { t } = useTranslation()
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
  const shown = <T,>(s: Shown<T> | undefined) =>
    s?.shot === nominal.shot && (s.t === t || 'answer' in s.attempt) ? s.attempt : undefined
  const planned = shown(plan)
  const fitted = shown(fit)
  const planLines =
    planned && 'answer' in planned
      ? parameterLines(planned.answer.parameters, system, t)
      : undefined
  const fitLines =
    fitted && 'answer' in fitted ? parameterLines(fitted.answer.parameters, system, t) : undefined
  const cell = (i: number, key: keyof TruingRow, name: string, unit: string) => (
    <TextInput
      aria-label={
        unit
          ? t('{name}, row {n} ({unit})', { name, n: i + 1, unit })
          : t('{name}, row {n}', { name, n: i + 1 })
      }
      inputMode="decimal"
      value={rows[i]?.[key] ?? ''}
      onChange={(e) => setRow(i, { [key]: e.currentTarget.value })}
    />
  )
  return (
    <div className="truing-session">
      <p className="note">
        {t('Nominal shot from the inputs above: {shot}. Impacts are taken at the zero setting.', {
          shot: nominalLine(
            {
              bullet: nominal.bullet,
              muzzleVelocity: nominal.shot.muzzleVelocity,
              zeroRange: nominal.zeroRange,
            },
            system,
            t,
          ),
        })}
      </p>
      <div className="truing-fields">
        <TextInput
          label={t('Click value ({unit})', { unit: symbol })}
          inputMode="decimal"
          value={click}
          onChange={(e) => edit(() => setTypedClick(e.currentTarget.value))}
        />
        <TextInput
          label={t('Dispersion of one shot ({unit})', { unit: symbol })}
          description={t('Plan only: the vertical spread of one shot.')}
          inputMode="decimal"
          value={dispersion}
          onChange={(e) => edit(() => setDispersion(e.currentTarget.value))}
        />
        <Checkbox
          label={t('Fit a zero offset')}
          checked={zeroOffset}
          onChange={(e) => edit(() => setZeroOffset(e.currentTarget.checked))}
        />
      </div>
      <p className="note">
        {t(
          'Mean and deviation of an impact are its height above the line of sight in {unit}, of a dial in clicks.',
          { unit: offset },
        )}
      </p>
      <PanelTable
        label={t('Range string')}
        className="truing-table"
        caption={t('Distances shot')}
        columns={[t('Kind'), t('Distance'), t('Shots'), t('Mean'), t('Deviation of one shot')]}
      >
        {rows.map((r, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: rows have no id and keep their order
          <tr key={i}>
            <td>
              <NativeSelect
                aria-label={t('Kind, row {n}', { n: i + 1 })}
                value={r.kind}
                data={[
                  { value: 'impact', label: t('Impact') },
                  { value: 'dial', label: t('Dial') },
                ]}
                onChange={(e) => setRow(i, { kind: e.currentTarget.value as TruingRow['kind'] })}
              />
            </td>
            <td>{cell(i, 'range', t('Distance'), system.range.symbol)}</td>
            <td>{cell(i, 'shots', t('Shots'), '')}</td>
            <td>{cell(i, 'mean', t('Mean'), r.kind === 'impact' ? offset : t('clicks'))}</td>
            <td>
              {cell(
                i,
                'deviation',
                t('Deviation of one shot'),
                r.kind === 'impact' ? offset : t('clicks'),
              )}
            </td>
          </tr>
        ))}
      </PanelTable>
      <div className="truing-fields">
        {(
          [
            ['shots', t('Chronograph readings'), t('Chronograph readings')],
            [
              'mean',
              t('Chronograph mean'),
              t('Chronograph mean ({unit})', { unit: system.velocity.symbol }),
            ],
            [
              'deviation',
              t('Chronograph deviation'),
              t('Chronograph deviation ({unit})', { unit: system.velocity.symbol }),
            ],
          ] as const
        ).map(([key, name, label]) => (
          <TextInput
            key={name}
            label={label}
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
            setPlan({ shot: nominal.shot, t, attempt: planSession(nominal.shot, inputs, t) })
          }
        >
          {t('Plan')}
        </Button>
        <Button
          onClick={() =>
            setFit({ shot: nominal.shot, t, attempt: fitSession(nominal.shot, inputs, t) })
          }
        >
          {t('Fit')}
        </Button>
        <Button variant="subtle" onClick={() => edit(() => setRows((all) => [...all, blankRow()]))}>
          {t('Add row')}
        </Button>
        <Button
          variant="subtle"
          disabled={rows.length <= 1}
          onClick={() => edit(() => setRows((all) => all.slice(0, -1)))}
        >
          {t('Remove last row')}
        </Button>
      </div>
      <p role="status" className="visually-hidden">
        {planLines && countText(t('Plan'), planLines, t)}{' '}
        {fitLines && countText(t('Fit'), fitLines, t)}
      </p>
      {planned && 'problem' in planned && (
        <p role="alert" className="error-text">
          {t('Plan: {problem}', { problem: planned.problem })}
        </p>
      )}
      {planLines && <Statuses lines={planLines} fit={false} />}
      {fitted && 'problem' in fitted && (
        <p role="alert" className="error-text">
          {t('Fit: {problem}', { problem: fitted.problem })}
        </p>
      )}
      {fitted && 'answer' in fitted && fitLines && (
        <section aria-labelledby="truing-fit" className="truing-result">
          <h3 id="truing-fit">{t('Fit result')}</h3>
          <Statuses lines={fitLines} fit />
          {residualLines(fitted.answer, t).map((line) => (
            <p key={line} className="note">
              {line}
            </p>
          ))}
          {fitted.answer.confounded.length > 0 && (
            <p className="note">
              {t(
                'Not separable from each other: {list}. Add distances, a dial row or a chronograph.',
                {
                  list: fitted.answer.confounded
                    .map((n) => t(parameterLabels[n].inline))
                    .join(', '),
                },
              )}
            </p>
          )}
          <StoreFit
            fit={fitted.answer}
            target={nominal.target}
            entry={() => truingEntry(nominal, inputs, fitted.answer, new Date())}
          />
        </section>
      )}
    </div>
  )
}
