'use client'

import type { ReactNode } from 'react'
import { useTranslation } from '../i18n/language.ts'
import { PageBar } from './page-bar.tsx'
import { PageNotFound } from './page-not-found.tsx'
import { DataError, type DataKind, type Loadable, Loading } from './states.tsx'
import { type RecordState, useRead, useRecord } from './use-record.ts'

/** The page while its data is read: the record's name under the page bar, the failure with Retry, or the not-found page. */
function Pending({
  name,
  what,
  state,
  retry,
}: {
  name: string
  what: DataKind
  state: Exclude<RecordState<unknown>, { status: 'ok' }>
  retry: () => void
}) {
  const { t } = useTranslation()
  if (state.status === 'notFound')
    return (
      <>
        <meta name="robots" content="noindex" />
        <PageNotFound />
      </>
    )
  return (
    <>
      <PageBar title={name} reserve />
      {state.status === 'error' ? (
        <DataError what={what} retry={retry} />
      ) : (
        // every `DataKind` lower-cased is a `Loadable`
        <Loading what={what.toLowerCase() as Loadable} rows={6} />
      )}
      <noscript>
        <p>{t('This page needs JavaScript.')}</p>
      </noscript>
    </>
  )
}

/** The names a record page passes to its body: the record `<kind>/<id>`, its name for the loading state and `what` (`Bullet`) for the messages. */
interface RecordRef {
  kind: string
  id: string
  name: string
  what: DataKind
}

/**
 * The shared body of a record page: the page's HTML holds the head tags (the route's metadata) and
 * a loading state under the record's name; the record is read from its data file in the browser and
 * `children` renders it, the drawings and tables included.
 */
export function RecordView<T>({
  kind,
  id,
  name,
  what,
  children,
}: RecordRef & { children: (record: T) => ReactNode }) {
  const { state, retry } = useRecord<T>(kind, id)
  if (state.status === 'ok') return children(state.data)
  return <Pending name={name} what={what} state={state} retry={retry} />
}

function Extras<X>({
  name,
  what,
  load,
  children,
}: {
  name: string
  what: DataKind
  load: (signal: AbortSignal) => Promise<X>
  children: (extras: X) => ReactNode
}) {
  const { state, retry } = useRead(load)
  if (state.status === 'ok') return children(state.data)
  return <Pending name={name} what={what} state={state} retry={retry} />
}

/**
 * `RecordView` of a record whose page also reads `extras` (lists and other records through
 * `apiFetch`): the loading state stays until both are read.
 */
export function RecordViewWith<T, X>({
  extras,
  children,
  ...ref
}: RecordRef & {
  extras: (record: T, signal: AbortSignal) => Promise<X>
  children: (record: T, extras: X) => ReactNode
}) {
  return (
    <RecordView<T> {...ref}>
      {(record) => (
        <Extras name={ref.name} what={ref.what} load={(signal) => extras(record, signal)}>
          {(x) => children(record, x)}
        </Extras>
      )}
    </RecordView>
  )
}
