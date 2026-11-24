import { createFileRoute } from '@tanstack/react-router'
import { DisciplineRecordPage } from '../../components/discipline-record-page.tsx'
import { NotFoundPage } from '../-not-found.tsx'
import { loadRecord, recordHead } from '../-record.tsx'

export const Route = createFileRoute('/disciplines/$id')({
  loader: ({ params }) => loadRecord('disciplines', params.id),
  head: ({ loaderData }) => recordHead(loaderData),
  component: RecordRoute,
  notFoundComponent: NotFoundPage,
})

function RecordRoute() {
  return <DisciplineRecordPage id={Route.useParams().id} name={Route.useLoaderData().name} />
}
