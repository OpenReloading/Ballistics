import { createFileRoute } from '@tanstack/react-router'
import { CartridgeRecordPage } from '../../components/cartridge-record-page.tsx'
import { NotFoundPage } from '../-not-found.tsx'
import { loadRecord, recordHead } from '../-record.tsx'

export const Route = createFileRoute('/cartridges/$id')({
  loader: ({ params }) => loadRecord('cartridges', params.id),
  head: ({ loaderData }) => recordHead(loaderData),
  component: RecordRoute,
  notFoundComponent: NotFoundPage,
})

function RecordRoute() {
  return <CartridgeRecordPage id={Route.useParams().id} name={Route.useLoaderData().name} />
}
