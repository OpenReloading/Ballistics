'use client'

import { toSi } from '@open-reloading/schema'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { requestTimeout } from '../lib/api-client.ts'
import { apiFetch } from '../lib/api-fetch.ts'
import {
  type BarrelRow,
  barrelDefaults,
  barrelRows,
  inEveryUnit,
  type LongerRun,
  longerBody,
  longerTravel,
  type RangeErrors,
  type RangeKey,
  rangeLengths,
} from '../lib/barrel-length.ts'
import type { FieldValue } from '../lib/field-spec.ts'
import { nth } from '../lib/nth.ts'
import { roundedFieldText, type UnitSystem } from '../lib/units.ts'
import {
  needsNetwork,
  notReached,
  type Outcome,
  type ShownStep,
  singleCharge,
  stepsOf,
  stripFigureOf,
} from './workbench-outcome.ts'

export type { RangeKey }

/** One ladder step of the study: its rows, none for a step the model reported as invalid. */
export type BarrelStep = { n: number; label: string; charge: number; rows?: BarrelRow[] }

/** The Barrel length tab's state. */
export type BarrelStudy = {
  range: Record<RangeKey, FieldValue>
  setRange: (key: RangeKey, value: FieldValue) => void
  /** Why the range gives no lengths, per field. */
  errors?: RangeErrors
  /** The run's barrel is the workbench's barrel length; false when the typed travel differs. */
  atSeating: boolean
  /** The seated bullet's base from the head, m; none without a seated bullet. */
  base?: number
  /** Every step of the run, in ladder order. */
  steps: BarrelStep[]
  selected: number
  /** Names the longer run asked for (the run, its travel, the attempt); none when it needs none. */
  key?: string
  /** The longer run is on its way, or failed with `message`. */
  pending: boolean
  message?: string
  /** Asks for the longer run again after it failed. */
  retry: () => void
}

type LongerAnswer = { runs?: (LongerRun | undefined)[]; message?: string }

/** The longer run of the study, or its failure; nothing once the request was aborted. */
async function requestLonger(
  ok: Extract<Outcome, { kind: 'ok' }>,
  single: boolean,
  travel: number,
  signal: AbortSignal,
): Promise<LongerAnswer | undefined> {
  try {
    const res = await apiFetch('interior', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(
        longerBody(
          ok.load,
          single ? [ok.load.charge] : ok.steps.map((s) => s.charge),
          ok.direction,
          travel,
        ),
      ),
      signal,
    })
    const json = await res.json().catch(() => undefined)
    if (signal.aborted) return undefined
    if (!res.ok || json === undefined)
      return { message: json?.message ?? `The API answered ${res.status}.` }
    return {
      // a step the model reports as invalid keeps its reason, as the workbench shows it
      runs: stepsOf(json, nth(ok.steps, 0).charge).map((s) =>
        s.body ? s.body.result : { reason: s.error?.reason ?? s.error?.message ?? 'invalid' },
      ),
    }
  } catch {
    if (signal.aborted) return undefined
    return { message: navigator.onLine ? notReached : needsNetwork }
  }
}

/** The rows of every step; none for a step the model reported as invalid or without a seated bullet. */
function stepRows(
  ok: Extract<Outcome, { kind: 'ok' }> | undefined,
  steps: ShownStep[],
  lengths: number[] | undefined,
  base: number | undefined,
  runs: LongerAnswer['runs'],
): BarrelStep[] {
  return steps.map(({ n, label, charge, body }, i) => ({
    n,
    label,
    charge,
    rows:
      ok && body && lengths && base !== undefined
        ? barrelRows({
            result: body.result,
            longer: runs?.[i],
            mass: ok.load.bullet.mass,
            baseFromHead: base,
            lengths,
          })
        : undefined,
  }))
}

/** Whether the run's barrel is the seating's barrel length, within the shown precision, 0.05 mm. */
function atSeatingOf(
  base: number | undefined,
  seatedBarrel: number | undefined,
  runTravel: number | undefined,
) {
  if (base === undefined || seatedBarrel === undefined || runTravel === undefined) return true
  return Math.abs(base + runTravel - seatedBarrel) < 5e-5
}

/**
 * The study of the shown run: the range the user typed (the defaults until then), the longer run
 * for the lengths beyond the barrel, requested once the tab has been opened (`enabled`), and the
 * rows of every step.
 */
export function useBarrelStudy({
  ok,
  steps,
  system,
  enabled,
}: {
  ok: Extract<Outcome, { kind: 'ok' }> | undefined
  steps: ShownStep[]
  system: UnitSystem
  enabled: boolean
}): BarrelStudy {
  const symbol = system.barrelLength.symbol
  const [typed, setTyped] = useState<Partial<Record<RangeKey, FieldValue>>>({})
  const [unit, setUnit] = useState(symbol)
  // a change of the length unit in the Settings starts the range afresh
  if (unit !== symbol) {
    setUnit(symbol)
    setTyped({})
  }
  const range = useMemo(() => {
    const defaults = barrelDefaults(system)
    const field = (k: RangeKey): FieldValue =>
      typed[k] ?? { text: roundedFieldText('barrelLength', system, defaults[k]), si: defaults[k] }
    return { from: field('from'), to: field('to'), step: field('step') }
  }, [typed, system])
  const planned = useMemo(
    () => rangeLengths(range.from.si, range.to.si, range.step.si, (m) => inEveryUnit(system, m)),
    [range.from.si, range.to.si, range.step.si, system],
  )
  const lengths = 'lengths' in planned ? planned.lengths : undefined
  const figure = ok && stripFigureOf(ok)
  const single = singleCharge(ok)
  const base = figure && toSi('length', figure.base)
  const runTravel = ok?.load.barrel.length
  const travel =
    lengths && base !== undefined && runTravel !== undefined
      ? longerTravel(lengths, base, runTravel)
      : undefined
  const [attempt, setAttempt] = useState(0)
  const key =
    ok && travel !== undefined
      ? `${ok.id}|${single ? `${ok.selected}|` : ''}${travel}|${attempt}`
      : undefined
  const [longer, setLonger] = useState<{
    key: string
    runs?: (LongerRun | undefined)[]
    message?: string
  }>()
  // the request reads the run it was made for: a step change does not send it again
  // biome-ignore lint/correctness/useExhaustiveDependencies: `key` names the run and the travel
  useEffect(() => {
    if (!enabled || !ok || travel === undefined || key === undefined) return
    const controller = new AbortController()
    let late: ReturnType<typeof setTimeout> | undefined
    const timer = setTimeout(async () => {
      // an API that never answers ends as a failure with Retry, also for a print waiting for it
      late = setTimeout(() => {
        controller.abort()
        setLonger({ key, message: `The longer run did not answer in ${requestTimeout / 1000} s.` })
      }, requestTimeout)
      try {
        const answer = await requestLonger(ok, single, travel, controller.signal)
        if (answer) setLonger({ key, ...answer })
      } finally {
        clearTimeout(late)
      }
      // typing into the range waits for a pause
    }, 300)
    return () => {
      clearTimeout(timer)
      clearTimeout(late)
      controller.abort()
    }
  }, [enabled, key])
  const got = longer?.key === key ? longer : undefined
  const pending = enabled && key !== undefined && got === undefined
  const rows = useMemo(
    () => stepRows(ok, steps, lengths, base, got?.runs),
    [ok, steps, lengths, base, got],
  )
  const setRange = useCallback(
    (k: RangeKey, v: FieldValue) => setTyped((t) => ({ ...t, [k]: v })),
    [],
  )
  const errors = 'errors' in planned ? planned.errors : undefined
  const seatedBarrel = ok?.printed.seated.barrel
  const atSeating = atSeatingOf(base, seatedBarrel, runTravel)
  const retry = useCallback(() => setAttempt((a) => a + 1), [])
  // a seating ladder's study holds the shown step alone (`workbench.tsx`)
  const [selected, message] = [single ? 0 : (ok?.selected ?? 0), got?.message]
  return useMemo(
    () => ({
      range,
      setRange,
      errors,
      atSeating,
      base,
      steps: rows,
      selected,
      key,
      pending,
      message,
      retry,
    }),
    [range, setRange, errors, atSeating, base, rows, selected, key, pending, message, retry],
  )
}
