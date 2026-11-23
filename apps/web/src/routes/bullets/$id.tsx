import { createFileRoute } from '@tanstack/react-router'
import { NotFoundPage } from '../-not-found.tsx'
import { loadRecord, RecordPage, recordHead } from '../-record.tsx'

export const Route = createFileRoute('/bullets/$id')({
  loader: ({ params }) => loadRecord('bullets', params.id),
  head: ({ loaderData }) => recordHead(loaderData),
  component: RecordPage,
  notFoundComponent: NotFoundPage,
})
