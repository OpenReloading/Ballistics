import { createFileRoute } from '@tanstack/react-router'
import { PrimerRecordPage } from '../../components/primer-record-page.tsx'
import { NotFoundPage } from '../-not-found.tsx'
import { loadRecord, recordHead } from '../-record.tsx'

export const Route = createFileRoute('/primers/$id')({
  loader: ({ params }) => loadRecord('primers', params.id),
  head: ({ loaderData }) => recordHead(loaderData),
  component: RecordRoute,
  notFoundComponent: NotFoundPage,
})

function RecordRoute() {
  return <PrimerRecordPage id={Route.useParams().id} name={Route.useLoaderData().title} />
}
