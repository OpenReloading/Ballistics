import { createFileRoute } from '@tanstack/react-router'
import { PowderRecordPage } from '../../components/powder-record-page.tsx'
import { NotFoundPage } from '../-not-found.tsx'
import { loadRecord, recordHead } from '../-record.tsx'

export const Route = createFileRoute('/powders/$id')({
  loader: ({ params }) => loadRecord('powders', params.id),
  head: ({ loaderData }) => recordHead(loaderData),
  component: RecordRoute,
  notFoundComponent: NotFoundPage,
})

function RecordRoute() {
  return <PowderRecordPage id={Route.useParams().id} name={Route.useLoaderData().title} />
}
