import { createFileRoute } from '@tanstack/react-router'
import { CaseRecordPage } from '../../components/case-record-page.tsx'
import { NotFoundPage } from '../-not-found.tsx'
import { loadRecord, recordHead } from '../-record.tsx'

export const Route = createFileRoute('/cases/$id')({
  loader: ({ params }) => loadRecord('cases', params.id),
  head: ({ loaderData }) => recordHead(loaderData),
  component: RecordRoute,
  notFoundComponent: NotFoundPage,
})

function RecordRoute() {
  return <CaseRecordPage id={Route.useParams().id} name={Route.useLoaderData().title} />
}
