import type { Bullet } from '@rangefoundry/schema'
import { createFileRoute } from '@tanstack/react-router'
import { BulletRecordPage } from '../../components/bullet-record-page.tsx'
import type { CartridgeSummary } from '../../lib/api-types.ts'
import { fitsOf } from '../../lib/bullet-fit.ts'
import { readCatalogue, readData } from '../-data.ts'
import { NotFoundPage } from '../-not-found.tsx'
import { loadRecord, recordHead } from '../-record.tsx'

export const Route = createFileRoute('/bullets/$id')({
  loader: async ({ params }) => {
    // after loadRecord, which checks the id that becomes part of a file path
    const head = await loadRecord('bullets', params.id)
    const [bullet, catalogue] = await Promise.all([
      readData(`bullets/${params.id}`) as Promise<Bullet>,
      readCatalogue(),
    ])
    const cartridges = catalogue.cartridges().items as CartridgeSummary[]
    return { ...head, fits: fitsOf(bullet.diameter?.value, cartridges) }
  },
  head: ({ loaderData }) => recordHead(loaderData),
  component: BulletRoute,
  notFoundComponent: NotFoundPage,
})

function BulletRoute() {
  const { title, fits } = Route.useLoaderData()
  return <BulletRecordPage id={Route.useParams().id} name={title} fits={fits} />
}
