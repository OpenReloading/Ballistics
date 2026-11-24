import type { EventType } from '@rangefoundry/schema'
import { createFileRoute } from '@tanstack/react-router'
import { CompetitionEvents } from '../components/competition-events.tsx'
import { readCatalogue, readRecords } from './-data.ts'
import { listHead } from './-list-route.ts'
import { searchOf } from './-search.ts'

export const Route = createFileRoute('/events')({
  validateSearch: searchOf(),
  loader: async () =>
    readRecords<EventType>('event-types', (await readCatalogue()).eventTypes().items),
  head: () =>
    listHead(
      'Competition events',
      'Your competition events with ring series or practical stages and their totals, kept in this browser; print an event, export CSV and JSON.',
    ),
  component: EventsPage,
})

function EventsPage() {
  return <CompetitionEvents types={Route.useLoaderData()} />
}
