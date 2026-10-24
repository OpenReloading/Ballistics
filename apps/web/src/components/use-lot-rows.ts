'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { requestTimeout } from '../lib/api-client.ts'
import { apiFetch } from '../lib/api-fetch.ts'
import type { FieldValue } from '../lib/field-spec.ts'
import {
  type BarrelTimes,
  barrelTimes,
  defaultLotFraction,
  type Lot,
  lotBody,
  lotFractionError,
  lots,
} from '../lib/lot-rows.ts'
import { roundedFieldText, type UnitSystem } from '../lib/units.ts'
import {
  needsNetwork,
  notReached,
  type Outcome,
  type ShownStep,
  type Step,
  shownSteps,
  stepsOf,
} from './workbench-outcome.ts'

/** The lot rows of the shown run: the extra rows at a burn rate above and below, and what the chart reads. */
export type LotRows = {
  /** A charge ladder with more than one step: the only run with lot rows. */
  applies: boolean
  /** The burn-rate change, a fraction. */
  percent: FieldValue
  setPercent: (v: FieldValue) => void
  /** Why the typed change gives no rows. */
  error?: string
  /** The typed target barrel time, ms; empty for none. */
  target: string | number
  setTarget: (v: string | number) => void
  /** The target barrel time, s; none when empty or not above 0. */
  targetSeconds?: number
  /** Names the request (the run, the change, the attempt); none when it needs none. */
  key?: string
  /** The rows are on their way, or failed with `message`. */
  pending: boolean
  message?: string
  retry: () => void
  /** The rows of the last answer for this run, with the change they were asked at. */
  rows?: { fraction: number; steps: Record<Lot, ShownStep[]>; times: BarrelTimes[] }
}

/**
 * The answers of the two lots, one request after the other and none after a failed one: a ladder asks
 * for several pool tasks at once, so two ladders at once fill the queue of a small pool and the API
 * answers busy.
 */
async function askLots(
  ok: Extract<Outcome, { kind: 'ok' }>,
  charges: number[],
  fraction: number,
  signal: AbortSignal,
) {
  const answers = []
  for (const lot of lots) {
    const res = await apiFetch('interior', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(lotBody(ok.load, charges, ok.direction, lot, fraction, ok.cartridge)),
      signal,
    })
    answers.push({ res, json: await res.json().catch(() => undefined) })
    if (!res.ok) break
  }
  return answers
}

/**
 * The lot rows of the shown run: two ladder requests, one per lot, at the burn rate raised and
 * lowered by the typed change, asked once the tab or a print wants them (`enabled`). A new change
 * waits for a pause; the rows of the last answer stay until the next one arrives.
 */
export function useLotRows({
  ok,
  system,
  enabled,
}: {
  ok: Extract<Outcome, { kind: 'ok' }> | undefined
  system: UnitSystem
  enabled: boolean
}): LotRows {
  const applies = ok !== undefined && ok.ladder.kind === 'charge' && ok.steps.length > 1
  const [percent, setPercent] = useState<FieldValue>(() => ({
    text: roundedFieldText('percent', system, defaultLotFraction),
    si: defaultLotFraction,
  }))
  const [target, setTarget] = useState<string | number>('')
  const [attempt, setAttempt] = useState(0)
  const fraction = percent.si
  const error = applies ? lotFractionError(fraction) : undefined
  const key = ok && applies && !error ? `${ok.id}|${fraction}|${attempt}` : undefined
  const [got, setGot] = useState<{
    key: string
    run: number
    fraction: number
    steps?: Record<Lot, Step[]>
    message?: string
  }>()
  const current = got && ok && got.run === ok.id ? got : undefined
  const pause = current ? 300 : 0
  // the request reads the run it was made for: a step change does not send it again
  // biome-ignore lint/correctness/useExhaustiveDependencies: `key` names the run, the change and the attempt
  useEffect(() => {
    if (!enabled || !ok || fraction === undefined || key === undefined) return
    const controller = new AbortController()
    let late: ReturnType<typeof setTimeout> | undefined
    const [run, charges] = [ok.id, ok.steps.map((s) => s.charge)]
    const timer = setTimeout(async () => {
      // an API that never answers ends as a failure with Retry, also for a print waiting for it
      late = setTimeout(() => {
        controller.abort()
        setGot({
          key,
          run,
          fraction,
          message: `The lot rows did not answer in ${requestTimeout / 1000} s.`,
        })
      }, requestTimeout)
      try {
        const answers = await askLots(ok, charges, fraction, controller.signal)
        if (controller.signal.aborted) return
        const failed = answers.find((a) => !a.res.ok || a.json === undefined)
        if (failed)
          return setGot({
            key,
            run,
            fraction,
            message: failed.json?.message ?? `The API answered ${failed.res.status}.`,
          })
        const [low, high] = answers.map((a) => stepsOf(a.json, charges[0]))
        setGot({ key, run, fraction, steps: { low, high } })
      } catch {
        if (!controller.signal.aborted)
          setGot({ key, run, fraction, message: navigator.onLine ? notReached : needsNetwork })
      } finally {
        clearTimeout(late)
      }
      // typing into the field waits for a pause; the first request does not
    }, pause)
    return () => {
      clearTimeout(timer)
      clearTimeout(late)
      controller.abort()
    }
  }, [enabled, key])
  const pending = enabled && key !== undefined && got?.key !== key
  const rows = useMemo(() => {
    if (!ok || !current?.steps) return
    const steps = {
      low: shownSteps({ ...ok, steps: current.steps.low }),
      high: shownSteps({ ...ok, steps: current.steps.high }),
    }
    const times = barrelTimes(
      ok.steps.map((s) => ({ charge: s.charge, barrelTime: s.body?.result.barrelTime })),
      {
        low: current.steps.low.map((s) => ({ barrelTime: s.body?.result.barrelTime })),
        high: current.steps.high.map((s) => ({ barrelTime: s.body?.result.barrelTime })),
      },
    )
    return { fraction: current.fraction, steps, times }
  }, [ok, current])
  const retry = useCallback(() => setAttempt((a) => a + 1), [])
  const seconds = Number(target) * 1e-3
  const targetSeconds = target !== '' && seconds > 0 ? seconds : undefined
  const message = got?.key === key ? got?.message : undefined
  // one value while nothing changed: the result context holds it, and a keystroke in the inputs must not render the results again
  return useMemo(
    () => ({
      applies,
      percent,
      setPercent,
      error,
      target,
      setTarget,
      targetSeconds,
      key,
      pending,
      message,
      retry,
      rows,
    }),
    [applies, percent, error, target, targetSeconds, key, pending, message, retry, rows],
  )
}
