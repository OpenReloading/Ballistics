import type { Metadata } from 'next'
import { Suspense } from 'react'
import { CompetitionEvents } from '../../components/competition-events.tsx'
import { PageBar } from '../../components/page-bar.tsx'
import { ListLoading, ServerDataError } from '../../components/states.tsx'
import { msg } from '../../i18n/translate.ts'
import { getEventType, listEventTypes } from '../../lib/api.ts'

export const metadata: Metadata = {
  title: 'Competition events',
  description:
    'Your competition events with ring series or practical stages and their totals, kept in this browser; print an event, export CSV and JSON.',
}

const title = msg('Competition events')

async function Events() {
  const list = await listEventTypes()
  const records =
    list.status === 'ok' ? await Promise.all(list.data.map((t) => getEventType(t.id))) : []
  if (list.status !== 'ok' || records.some((r) => r.status !== 'ok'))
    return (
      <>
        <PageBar title={title} translated />
        <ServerDataError what="Event type" />
      </>
    )
  return <CompetitionEvents types={records.flatMap((r) => (r.status === 'ok' ? [r.data] : []))} />
}

export default function EventsPage() {
  return (
    <Suspense
      fallback={
        <>
          <PageBar title={title} translated />
          <ListLoading what="your data" />
        </>
      }
    >
      <Events />
    </Suspense>
  )
}
