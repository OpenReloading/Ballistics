'use client'

import type { Powder } from '@openreloading/schema'
import { useEffect, useRef, useState } from 'react'
import { fetchPowder, fetchPowderList, postInteriorRun, postJson } from '../lib/api-client.ts'
import type { InteriorResponse, PowderSummary } from '../lib/api-types.ts'
import { runBatch } from '../lib/batch.ts'
import {
  type ChargeTargetRefusal,
  type ChargeTargetResponse,
  chargeTargetBody,
  noComparableLimitText,
} from '../lib/charge-target.ts'
import { errorText } from '../lib/error-text.ts'
import type { InteriorBody } from '../lib/interior-input.ts'
import { fetchManufacturerNames, noManufacturerNames } from '../lib/manufacturers.ts'
import {
  type CompareMode,
  compareCharge,
  compareConcurrency,
  compareKey,
} from '../lib/powder-compare.ts'
import { percentOfPressureLimit } from '../lib/workbench.ts'
import type { UseWorkbenchStateResult } from './use-workbench-load.ts'
import { derived, stepFlag } from './workbench-outcome.ts'

/** One powder of the Powders tab. */
export type CompareRow = {
  id: string
  manufacturerName: string
  name: string
  base?: string
  form?: string
  /** kg. */
  charge?: number
  /** Charge over the free volume at the record's bulk density; none without a bulk density. */
  ratio?: number
  values?: {
    peak: number
    /** Of the first compared limit; none without one. */
    percent?: number
    velocity: number
    burnt: number
    /** Travel at burnout, m; none when the powder does not burn out in the barrel. */
    burnout?: number
    /** Pa: the pressure range of the run, low and high. */
    range: { low: number; high: number }
  }
  flag?: string
  /** Why the powder has no values. */
  reason?: string
  /** The solver's 422 answer of a target mode row, worded in the units shown by `refusalText`. */
  refusal?: ChargeTargetRefusal
}

/**
 * The values of a row from the answer of a run at `charge` (kg) of the request `req`; a row that
 * cannot be built is one powder not computed, not the end of the batch.
 */
export function answerRow(
  head: Pick<CompareRow, 'id' | 'manufacturerName' | 'name' | 'base' | 'form'>,
  req: {
    body: { load: InteriorBody['load'] }
    bulkDensity?: number
    resistanceMissing?: { powder: string; missing: string[] }
  },
  charge: number,
  answer: InteriorResponse,
): CompareRow {
  try {
    const shown = {
      body: answer,
      load: { ...req.body.load, charge },
      bulkDensity: req.bulkDensity,
      resistanceMissing: req.resistanceMissing,
    }
    const r = answer.result
    return {
      ...head,
      charge,
      ratio: derived(shown).ratio,
      values: {
        peak: answer.pressureRange.nominalPressure,
        percent: percentOfPressureLimit(r.peakBreechPressure, answer.limits)?.percent,
        velocity: r.muzzleVelocity,
        burnt: r.muzzleBurntFraction,
        burnout: r.burnout?.travel,
        range: { low: answer.pressureRange.lowPressure, high: answer.pressureRange.highPressure },
      },
      flag: stepFlag(shown),
    }
  } catch (err) {
    return { ...head, charge, reason: errorText(err) }
  }
}

/** The Powders tab's state: the rows, the progress of the batch and what the rows were computed for. */
type PowderCompare = {
  rows: CompareRow[]
  progress?: { done: number; total: number }
  running: boolean
  message?: string
  /** Names the load and charge mode the rows were computed for. */
  key?: string
  /** The mode the rows were computed for. */
  mode?: CompareMode
  compute: () => void
  cancel: () => void
}

/**
 * The rows of the Powders tab: every powder of the API for the load `base` under `mode`, in batches
 * of `compareConcurrency` requests, by place in the powder list. `on.start` gets the number of
 * powders, `on.done` the count done and the rows so far after each answer. Undefined when `signal`
 * aborted before the batch started; an answer that arrives after it aborted is dropped. In the
 * target mode the first answer that the cartridge has no comparable limit (a percentage target)
 * ends the batch: every powder without a row has that reason (`noLimit`).
 */
export async function computeRows(
  loadRequest: UseWorkbenchStateResult['loadRequest'],
  base: ReturnType<UseWorkbenchStateResult['loadRequest']>,
  mode: CompareMode,
  signal: AbortSignal,
  on: {
    start: (total: number) => void
    done: (done: number, total: number, rows: () => CompareRow[]) => void
  },
): Promise<{ rows: CompareRow[]; total: number; noLimit?: ChargeTargetRefusal } | undefined> {
  const [powders, names] = await Promise.all([
    fetchPowderList(signal),
    // without names the rows show the product names alone
    fetchManufacturerNames().catch(() => noManufacturerNames),
  ])
  if (signal.aborted) return undefined
  const stop = new AbortController()
  const batch = AbortSignal.any([signal, stop.signal])
  let noLimit: ChargeTargetRefusal | undefined
  const { charge: typed, chamber } = base.body.load
  const headOf = (s: PowderSummary) => ({
    id: s.id,
    manufacturerName: names.get(s.manufacturer) ?? '',
    name: s.name,
    base: s.propellantBase,
    form: s.grainForm,
  })
  const computeOne = async (s: PowderSummary): Promise<CompareRow | undefined> => {
    const head = headOf(s)
    if (!s.interior) return { ...head, reason: 'No fitted model parameters' }
    let record: Powder | undefined
    try {
      record = await fetchPowder(s.id, batch)
    } catch {
      if (batch.aborted) return undefined
      return { ...head, reason: 'The API did not answer.' }
    }
    if (!record) return { ...head, reason: 'The powder record was not found.' }
    if (!record.interior) return { ...head, reason: 'No fitted model parameters' }
    const charge = compareCharge(mode, typed, record.bulkDensity?.value, chamber.volume)
    if (charge === undefined) return { ...head, reason: 'No bulk density in the record' }
    let req: ReturnType<typeof loadRequest>
    try {
      req = loadRequest({ powder: record, charge })
    } catch (err) {
      return { ...head, charge, reason: errorText(err) }
    }
    if (mode.kind === 'target') {
      // one solver task per powder: the charge is the answer, so a refusal has none
      const run = await postJson<ChargeTargetResponse>(
        'interior/charge-target',
        chargeTargetBody(req.body, req.bulkDensity, {
          kind: 'peakPressure',
          value: mode.value,
          percent: mode.percent,
        }),
        batch,
      )
      if (!run) return undefined
      if ('reason' in run) {
        if (run.refusal?.reason === 'noComparableLimit') {
          noLimit = run.refusal
          stop.abort()
        }
        return { ...head, reason: run.reason, refusal: run.refusal }
      }
      const { charge: solved, result } = run.answer
      const answer = { ...run.answer, result: { ...result, points: [] } } as InteriorResponse
      return answerRow(head, req, solved, answer)
    }
    const run = await postInteriorRun(req.body, batch)
    if (!run) return undefined
    if ('reason' in run) return { ...head, charge, reason: run.reason }
    return answerRow(head, req, charge, run.answer)
  }
  const slots: (CompareRow | undefined)[] = []
  const produced = () => slots.filter((r): r is CompareRow => r !== undefined)
  on.start(powders.length)
  await runBatch(powders, compareConcurrency, batch, computeOne, (i, row, n) => {
    if (batch.aborted) return
    slots[i] = row
    on.done(n, powders.length, produced)
  })
  if (noLimit && !signal.aborted)
    powders.forEach((s, i) => {
      slots[i] ??= s.interior
        ? { ...headOf(s), reason: noLimit?.message ?? noComparableLimitText, refusal: noLimit }
        : { ...headOf(s), reason: 'No fitted model parameters' }
    })
  return { rows: produced(), total: powders.length, noLimit }
}

/**
 * Computes every powder with model parameters for the load of the workbench, in batches of
 * `compareConcurrency` requests to `POST /interior`, and keeps the rows. Each powder is the load with
 * its record chosen, so a row is the Run of that choice (`loadRequest` of the workbench).
 */
export function usePowderCompare(
  loadRequest: UseWorkbenchStateResult['loadRequest'],
  mode: CompareMode,
): PowderCompare {
  const [rows, setRows] = useState<CompareRow[]>([])
  const [progress, setProgress] = useState<PowderCompare['progress']>()
  const [running, setRunning] = useState(false)
  const [message, setMessage] = useState<string>()
  const [key, setKey] = useState<string>()
  const [computed, setComputed] = useState<CompareMode>()
  const controller = useRef<AbortController>(undefined)
  // a closed tab or a left page ends the batch
  useEffect(() => () => controller.current?.abort(), [])

  async function compute() {
    controller.current?.abort()
    let base: ReturnType<typeof loadRequest>
    try {
      base = loadRequest()
    } catch (err) {
      return setMessage(errorText(err))
    }
    const abort = new AbortController()
    controller.current = abort
    const { signal } = abort
    setRunning(true)
    setMessage(undefined)
    setRows([])
    setProgress(undefined)
    // none until the list is fetched: zero rows are not rows of an earlier batch
    setKey(undefined)
    setComputed(undefined)
    // the 100 ms render of the table
    let timer: ReturnType<typeof setTimeout> | undefined
    // a later Compute replaces this batch: its answers no longer reach the state
    const current = () => controller.current === abort
    let produced: () => CompareRow[] = () => []
    // the table renders at most every 100 ms, not for each answer
    const flush = () => {
      clearTimeout(timer)
      timer = undefined
      if (current()) setRows(produced())
    }
    try {
      const done = await computeRows(loadRequest, base, mode, signal, {
        start: (total) => {
          setProgress({ done: 0, total })
          setKey(compareKey(base.body, mode, base.recordInputs))
          setComputed(mode)
        },
        done: (n, total, rowsSoFar) => {
          if (!current()) return
          produced = rowsSoFar
          setProgress({ done: n, total })
          timer ??= setTimeout(flush, 100)
        },
      })
      if (!done) return
      produced = () => done.rows
      flush()
      if (done.noLimit && !signal.aborted && current())
        setMessage(`Stopped. ${noComparableLimitText}`)
      else if (signal.aborted && current())
        setMessage(`Cancelled after ${done.rows.length} of ${done.total} powders.`)
    } catch (err) {
      if (!signal.aborted) setMessage(errorText(err))
    } finally {
      clearTimeout(timer)
      if (current()) setRunning(false)
    }
  }

  return {
    rows,
    progress,
    running,
    message,
    key,
    mode: computed,
    compute,
    cancel: () => controller.current?.abort(),
  }
}
