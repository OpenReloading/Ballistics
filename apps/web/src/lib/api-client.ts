/** Requests of the Powders tab through `apiFetch`: powder records and summaries, runs. */

import type { Powder } from '@open-reloading/schema'
import { apiFetch, fetchRecord } from './api-fetch.ts'
import type { ErrorBody, InteriorResponse, PowderSummary } from './api-types.ts'

/** Answers of a busy pool (503) are asked again this often before the powder counts as failed. */
const busyRetries = 5
/** A request that has not answered after this many ms counts as failed (the proxy gives up at 15 s). */
export const requestTimeout = 20_000

const records = new Map<string, Powder>()

/**
 * A powder record through `apiFetch`, kept for the session; undefined when not found
 * (404), a throw for any other refusal.
 */
export async function fetchPowder(id: string, signal?: AbortSignal): Promise<Powder | undefined> {
  const known = records.get(id)
  if (known) return known
  const record = await fetchRecord<Powder>('powders', id, signal)
  if (record) records.set(id, record)
  return record
}

/** Every powder summary, in pages of 200 (the API cap). */
export async function fetchPowderList(signal: AbortSignal): Promise<PowderSummary[]> {
  const items: PowderSummary[] = []
  for (let page = 0; page < 50; page++) {
    const res = await apiFetch(`powders?limit=200&offset=${page * 200}`, { signal })
    if (!res.ok) throw new Error(`The API answered ${res.status}.`)
    const json = (await res.json()) as { total: number; items: PowderSummary[] }
    items.push(...json.items)
    if (items.length >= json.total || json.items.length === 0) break
  }
  return items
}

const wait = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, ms)
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timer)
        resolve()
      },
      { once: true },
    )
  })

/** The answer, the reason there is none (`refusal`: the body of a 422), or undefined after an abort. */
type Posted<T> = { answer: T } | { reason: string; refusal?: ErrorBody } | undefined

/**
 * One POST. A busy pool (503 `busy`) gives its `retry-after` (s, at least 1) while `retry` holds;
 * every other refusal, a deadline and a lost connection give the reason.
 */
async function postOnce<T>(
  path: string,
  body: object,
  signal: AbortSignal,
  retry: boolean,
): Promise<Posted<T> | { retryAfter: number }> {
  try {
    const res = await apiFetch(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.any([signal, AbortSignal.timeout(requestTimeout)]),
    })
    const json = (await res.json().catch(() => undefined)) as (T & ErrorBody) | undefined
    // a body cut by the abort is no answer
    if (signal.aborted) return undefined
    if (res.ok && json) return { answer: json }
    if (res.status === 503 && json?.reason === 'busy' && retry)
      return { retryAfter: Math.max(1, Number(res.headers.get('retry-after')) || 1) }
    if (res.status === 503 && json?.reason === 'timeout')
      return { reason: 'The run passed the API deadline.' }
    return {
      reason: json?.message ?? `The API answered ${res.status}.`,
      ...(res.status === 422 && json && { refusal: json }),
    }
  } catch {
    if (signal.aborted) return undefined
    return { reason: 'The API did not answer.' }
  }
}

/** Runs `post` again after each busy answer's `retry-after`, `busyRetries` times at most; undefined once `signal` aborts. */
async function retryWhenBusy<T>(
  post: (retry: boolean) => Promise<Posted<T> | { retryAfter: number }>,
  signal: AbortSignal,
): Promise<Posted<T>> {
  for (let attempt = 0; ; attempt++) {
    const out = await post(attempt < busyRetries)
    if (!out || !('retryAfter' in out)) return out
    if (signal.aborted) return undefined
    await wait(out.retryAfter * 1000, signal)
    if (signal.aborted) return undefined
  }
}

/**
 * One POST: the answer, or the reason it gave none (`refusal`: the body of a 422). A busy pool (503
 * `busy`) is asked again after its `retry-after`, as the pool frees; every other refusal, a
 * deadline and a lost connection end the powder's row. Undefined when `signal` aborted.
 */
export function postJson<T>(path: string, body: object, signal: AbortSignal): Promise<Posted<T>> {
  return retryWhenBusy<T>((retry) => postOnce<T>(path, body, signal, retry), signal)
}

/** One `POST /interior` run: the answer without its points, or the reason it gave none. */
export async function postInteriorRun(
  body: object,
  signal: AbortSignal,
): Promise<{ answer: InteriorResponse } | { reason: string; refusal?: ErrorBody } | undefined> {
  const run = await postJson<InteriorResponse>('interior', body, signal)
  return run && 'answer' in run
    ? { answer: { ...run.answer, result: { ...run.answer.result, points: [] } } }
    : run
}
