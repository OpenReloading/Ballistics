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
