import { createFileRoute } from '@tanstack/react-router'
import { FederationRecordPage } from '../../components/federation-record-page.tsx'
import { NotFoundPage } from '../-not-found.tsx'
import { loadRecord, recordHead } from '../-record.tsx'

export const Route = createFileRoute('/federations/$id')({
  loader: ({ params }) => loadRecord('federations', params.id),
  head: ({ loaderData }) => recordHead(loaderData),
  component: RecordRoute,
  notFoundComponent: NotFoundPage,
})

function RecordRoute() {
  return <FederationRecordPage id={Route.useParams().id} name={Route.useLoaderData().name} />
}
