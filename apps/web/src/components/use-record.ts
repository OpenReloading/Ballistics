'use client'

import { useCallback, useEffect, useState } from 'react'
import { dataFile } from '../lib/data-file.ts'

/** A record read from its data file: still loading, read, no such file, or a failed read. */
export type RecordState<T> =
  | { status: 'loading' }
  | { status: 'ok'; data: T }
  | { status: 'notFound' }
  | { status: 'error' }

/**
 * The record `<kind>/<id>` of the export's data files (`kind` as `cartridges`), read in the browser
 * once the page mounts: the shared mechanism of the record pages, whose HTML holds only the head tags
 * and a loading state. `retry` reads again after a failure.
 */
export function useRecord<T>(kind: string, id: string) {
  const [state, setState] = useState<RecordState<T>>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)
  // biome-ignore lint/correctness/useExhaustiveDependencies: `attempt` reads the file again
  useEffect(() => {
    let current = true
    dataFile<T>(`${kind}/${id}`).then(
      (data) =>
        current && setState(data === undefined ? { status: 'notFound' } : { status: 'ok', data }),
      () => current && setState({ status: 'error' }),
    )
    return () => {
      current = false
    }
  }, [kind, id, attempt])
  const retry = useCallback(() => {
    setState({ status: 'loading' })
    setAttempt((n) => n + 1)
  }, [])
  return { state, retry }
}

/**
 * What a record page reads besides its record (lists, other records) through `load`, once per
 * attempt: the states of `useRecord` without `notFound`. `load` is not a dependency: it closes over
 * the record, which does not change while the page is mounted.
 */
export function useRead<T>(load: (signal: AbortSignal) => Promise<T>) {
  const [state, setState] = useState<RecordState<T>>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)
  // biome-ignore lint/correctness/useExhaustiveDependencies: `attempt` reads again
  useEffect(() => {
    const read = new AbortController()
    load(read.signal).then(
      (data) => setState({ status: 'ok', data }),
      () => read.signal.aborted || setState({ status: 'error' }),
    )
    return () => read.abort()
  }, [attempt])
  const retry = useCallback(() => {
    setState({ status: 'loading' })
    setAttempt((n) => n + 1)
  }, [])
  return { state, retry }
}
