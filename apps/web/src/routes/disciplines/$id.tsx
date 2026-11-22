import { createFileRoute } from '@tanstack/react-router'
import { NotFoundPage } from '../-not-found.tsx'
import { loadRecord, RecordPage, recordHead } from '../-record.tsx'

export const Route = createFileRoute('/disciplines/$id')({
  loader: ({ params }) => loadRecord('disciplines', params.id),
  head: ({ loaderData }) => recordHead(loaderData),
  component: RecordPage,
  notFoundComponent: NotFoundPage,
})
