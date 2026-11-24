import { createFileRoute } from '@tanstack/react-router'
import { TargetFaceRecordPage } from '../../components/target-face-record-page.tsx'
import { NotFoundPage } from '../-not-found.tsx'
import { loadRecord, recordHead } from '../-record.tsx'

export const Route = createFileRoute('/targets/$id')({
  loader: ({ params }) => loadRecord('target-faces', params.id),
  head: ({ loaderData }) => recordHead(loaderData),
  component: RecordRoute,
  notFoundComponent: NotFoundPage,
})

function RecordRoute() {
  return <TargetFaceRecordPage id={Route.useParams().id} name={Route.useLoaderData().name} />
}
