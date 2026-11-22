import { createFileRoute } from '@tanstack/react-router'
import { NotFoundPage } from '../-not-found.tsx'
import { loadRecord, RecordPage, recordHead } from '../-record.tsx'

export const Route = createFileRoute('/powders/$id')({
  loader: ({ params }) => loadRecord('powders', params.id),
  head: ({ loaderData }) => recordHead(loaderData),
  component: RecordPage,
  notFoundComponent: NotFoundPage,
})
