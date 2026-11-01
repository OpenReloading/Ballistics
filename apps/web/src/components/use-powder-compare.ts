'use client'

import type { Powder } from '@open-reloading/schema'
import { useEffect, useRef, useState } from 'react'
import { english, type Message, msg, type Translator } from '../i18n/translate.ts'
import { anySignal } from '../lib/any-signal.ts'
import { fetchPowder, fetchPowderList, postInteriorRun, postJson } from '../lib/api-client.ts'
import type { InteriorResponse, PowderSummary } from '../lib/api-types.ts'
import { runBatch } from '../lib/batch.ts'
import {
  type ChargeTargetRefusal,
  type ChargeTargetResponse,
  chargeTargetBody,
  noComparableLimitText,
} from '../lib/charge-target.ts'
import { translateMessage } from '../lib/core-messages.ts'
import { errorText } from '../lib/error-text.ts'
import type { InteriorBody } from '../lib/interior-input.ts'
import {
  fetchManufacturerNames,
  type ManufacturerNames,
  noManufacturerNames,
} from '../lib/manufacturers.ts'
import {
  type CompareMode,
  compareCharge,
  compareConcurrency,
  compareKey,
} from '../lib/powder-compare.ts'
import { percentOfPressureLimit } from '../lib/workbench.ts'
import type { UseWorkbenchStateResult } from './use-workbench-load.ts'
import { derived, stepFlag } from './workbench-outcome.ts'

const noModel = msg('No fitted model parameters')
const apiSilent = msg(
  'A data file did not load or the computation failed. Check the connection and retry.',
)
const noRecord = msg('The powder record was not found.')
/** Why a row has no case fill: the record gives no bulk density. */
export const noBulkDensity = msg('No bulk density in the record')

/** The sentences of this tab's rows; a row's other reasons are messages of the API and the packages. */
const ownReasons: readonly Message[] = [
  noModel,
  apiSilent,
  noRecord,
  noBulkDensity,
  noComparableLimitText,
]

/** A row's reason in the language of `t`. */
export function reasonText(reason: string, t: Translator['t']) {
  const own = ownReasons.find((m) => m === reason)
  return own ? t(own) : translateMessage(reason, t)
}

/** One powder of the Powders tab. */
export type CompareRow = {
  id: string
  manufacturerName: string
  name: string
  base?: string | undefined
  form?: string | undefined
  /** kg. */
  charge?: number
  /** Charge over the free volume at the record's bulk density; none without a bulk density. */
  ratio?: number | undefined
  values?: {
    peak: number
    /** Of the compared limit (`pressureLimit`); none without one. */
    percent?: number | undefined
    velocity: number
    burnt: number
    /** Travel at burnout, m; none when the powder does not burn out in the barrel. */
    burnout?: number | undefined
    /** Pa: the pressure range of the run, low and high. */
    range: { low: number; high: number }
  }
  /** The flag in English: the column's sort key. */
  flag?: string | undefined
  /** The flag in the language of `t`. */
  flagText?: ((t: Translator['t']) => string | undefined) | undefined
  /** Why the powder has no values. */
  reason?: string | undefined
  /** The solver's 422 answer of a target mode row, worded in the units shown by `refusalText`. */
  refusal?: ChargeTargetRefusal | undefined
}

/**
 * The values of a row from the answer of a run at `charge` (kg) of the request `req`; a row that
 * cannot be built is one powder not computed, not the end of the batch.
 */
export function answerRow(
  head: Pick<CompareRow, 'id' | 'manufacturerName' | 'name' | 'base' | 'form'>,
  req: {
    body: { load: InteriorBody['load'] }
    bulkDensity?: number | undefined
    resistanceMissing?: { powder: string; missing: string[] } | undefined
    castHardness?: number | undefined
  },
  charge: number,
  answer: InteriorResponse,
): CompareRow {
  try {
    const shown = {
      // the curve is not kept: the flag and the case fill read the numbers
      body: { ...answer, result: { ...answer.result, points: [] } },
      load: { ...req.body.load, charge },
      bulkDensity: req.bulkDensity,
      resistanceMissing: req.resistanceMissing,
      castHardness: req.castHardness,
    }
    const r = answer.result
    const flag = stepFlag(shown, english.t)
    return {
      ...head,
      charge,
      ratio: derived(shown, english.t).ratio,
      values: {
        peak: answer.pressureRange.nominalPressure,
        percent: percentOfPressureLimit(r.peakBreechPressure, answer.limits)?.percent,
        velocity: r.muzzleVelocity,
        burnt: r.muzzleBurntFraction,
        burnout: r.burnout?.travel,
        range: { low: answer.pressureRange.lowPressure, high: answer.pressureRange.highPressure },
      },
      flag,
      flagText: flag === undefined ? undefined : (t) => stepFlag(shown, t),
    }
  } catch (err) {
    return { ...head, charge, reason: errorText(err) }
  }
}

/** What the Powders tab says after a batch that stopped early or failed, in words the page puts together where it shows them. */
export type CompareMessage =
  | { kind: 'stopped' }
  | { kind: 'cancelled'; done: number; total: number }
  /** The message of an error as it came, English. */
  | { kind: 'error'; text: string }

/** The Powders tab's state: the rows, the progress of the batch and what the rows were computed for. */
type PowderCompare = {
  rows: CompareRow[]
  progress?: { done: number; total: number } | undefined
  running: boolean
  message?: CompareMessage | undefined
  /** Names the load and charge mode the rows were computed for. */
  key?: string | undefined
  /** The mode the rows were computed for. */
  mode?: CompareMode | undefined
  compute: () => void
  cancel: () => void
}

type RowHead = Pick<CompareRow, 'id' | 'manufacturerName' | 'name' | 'base' | 'form'>

/** The identity columns of a row. */
const rowHead = (names: ManufacturerNames, s: PowderSummary): RowHead => ({
  id: s.id,
  manufacturerName: names.get(s.manufacturer) ?? '',
  name: s.name,
  base: s.propellantBase,
  form: s.grainForm,
})

type RowContext = {
  loadRequest: UseWorkbenchStateResult['loadRequest']
  mode: CompareMode
  /** The workbench's charge, kg. */
  typed: number
  /** The free volume of the chamber, m3. */
  volume: number
  batch: AbortSignal
  /** The cartridge has no comparable limit: the rest of the batch gets that reason. */
  onNoLimit: (refusal: ChargeTargetRefusal) => void
}

/** The powder's record when it has model parameters, else the row that says why not. */
async function recordFor(
  head: RowHead,
  id: string,
  batch: AbortSignal,
): Promise<{ record: Powder } | { row: CompareRow | undefined }> {
  let record: Powder | undefined
  try {
    record = await fetchPowder(id, batch)
  } catch {
    return { row: batch.aborted ? undefined : { ...head, reason: apiSilent } }
  }
  if (!record) return { row: { ...head, reason: noRecord } }
  if (!record.interior) return { row: { ...head, reason: noModel } }
  return { record }
}

/** A target mode row: one solver task per powder, the charge is the answer, so a refusal has none. */
async function targetRow(
  cx: RowContext,
  head: RowHead,
  req: ReturnType<RowContext['loadRequest']>,
  mode: Extract<CompareMode, { kind: 'target' }>,
): Promise<CompareRow | undefined> {
  const run = await postJson<ChargeTargetResponse>(
    'interior/charge-target',
    chargeTargetBody(req.body, req.bulkDensity, {
      kind: 'peakPressure',
      value: mode.value,
      percent: mode.percent,
    }),
    cx.batch,
  )
  if (!run) return undefined
  if ('reason' in run) {
    if (run.refusal?.reason === 'noComparableLimit') cx.onNoLimit(run.refusal)
    return { ...head, reason: run.reason, refusal: run.refusal }
  }
  const { charge: solved, result } = run.answer
  const answer = { ...run.answer, result: { ...result, points: [] } } as InteriorResponse
  return answerRow(head, req, solved, answer)
}

/** One powder's row: its record, then its run, or the reason it has none. */
async function powderRow(
  cx: RowContext,
  head: RowHead,
  s: PowderSummary,
): Promise<CompareRow | undefined> {
  if (!s.interior) return { ...head, reason: noModel }
  const fetched = await recordFor(head, s.id, cx.batch)
  if ('row' in fetched) return fetched.row
  const { record } = fetched
  const charge = compareCharge(cx.mode, cx.typed, record.bulkDensity?.value, cx.volume)
  if (charge === undefined) return { ...head, reason: noBulkDensity }
  let req: ReturnType<RowContext['loadRequest']>
  try {
    req = cx.loadRequest({ powder: record, charge })
  } catch (err) {
    return { ...head, charge, reason: errorText(err) }
  }
  if (cx.mode.kind === 'target') return targetRow(cx, head, req, cx.mode)
  const run = await postInteriorRun(req.body, cx.batch)
  if (!run) return undefined
  if ('reason' in run) return { ...head, charge, reason: run.reason }
  return answerRow(head, req, charge, run.answer)
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
): Promise<
  { rows: CompareRow[]; total: number; noLimit?: ChargeTargetRefusal | undefined } | undefined
> {
  const [powders, names] = await Promise.all([
    fetchPowderList(signal),
    // without names the rows show the product names alone
    fetchManufacturerNames().catch(() => noManufacturerNames),
  ])
  if (signal.aborted) return undefined
  const stop = new AbortController()
  const batch = anySignal([signal, stop.signal])
  let noLimit: ChargeTargetRefusal | undefined
  const cx: RowContext = {
    loadRequest,
    mode,
    typed: base.body.load.charge,
    volume: base.body.load.chamber.volume,
    batch,
    onNoLimit: (refusal) => {
      noLimit = refusal
      stop.abort()
    },
  }
  const headOf = (s: PowderSummary) => rowHead(names, s)
  const computeOne = (s: PowderSummary) => powderRow(cx, headOf(s), s)
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
        : { ...headOf(s), reason: noModel }
    })
  return { rows: produced(), total: powders.length, noLimit }
}

/** The line after a batch that stopped early: no comparable limit, or cancelled. */
function endMessage(
  done: { rows: CompareRow[]; total: number; noLimit?: ChargeTargetRefusal | undefined },
  aborted: boolean,
): CompareMessage | undefined {
  if (done.noLimit && !aborted) return { kind: 'stopped' }
  if (aborted) return { kind: 'cancelled', done: done.rows.length, total: done.total }
  return
}

/** The workbench's load as a request, or why it cannot be built. */
function baseRequest(loadRequest: UseWorkbenchStateResult['loadRequest']) {
  try {
    return { base: loadRequest() }
  } catch (err) {
    return { message: errorText(err) }
  }
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
  const [message, setMessage] = useState<CompareMessage>()
  const [key, setKey] = useState<string>()
  const [computed, setComputed] = useState<CompareMode>()
  const controller = useRef<AbortController>(undefined)
  // a closed tab or a left page ends the batch
  useEffect(() => () => controller.current?.abort(), [])

  async function compute() {
    controller.current?.abort()
    const built = baseRequest(loadRequest)
    if ('message' in built) return setMessage({ kind: 'error', text: built.message })
    const { base } = built
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
      const ended = endMessage(done, signal.aborted)
      if (ended && current()) setMessage(ended)
    } catch (err) {
      if (!signal.aborted) setMessage({ kind: 'error', text: errorText(err) })
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
