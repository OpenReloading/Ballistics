import type { Powder } from '@open-reloading/schema'
import { createFileRoute, notFound } from '@tanstack/react-router'
import { PageNotFound } from '../../../../web/src/components/page-not-found.tsx'
import { PowderRecordPage } from '../../../../web/src/components/powder-record-page.tsx'
import type { ManufacturerSummary } from '../../../../web/src/lib/api-types.ts'
import { manufacturerNames } from '../../../../web/src/lib/manufacturers.ts'
import { recordHeadText } from '../../../../web/src/lib/record-metadata.ts'
import { catalogueIndex, items, readData } from '../../data.ts'

export const Route = createFileRoute('/powders/$id')({
  loader: async ({ params }) => {
    const record = await readData<Powder>(`powders/${params.id}`)
    if (!record) throw notFound()
    const index = await catalogueIndex()
    const names = manufacturerNames(items(index.manufacturers) as unknown as ManufacturerSummary[])
    return { title: recordHeadText('powders', record, names).title }
  },
  head: ({ loaderData }) => ({
    meta: loaderData ? [{ title: `${loaderData.title} | OpenReloading Ballistics` }] : [],
  }),
  component: PowderPage,
  notFoundComponent: PageNotFound,
})

function PowderPage() {
  const { title } = Route.useLoaderData()
  const { id } = Route.useParams()
  return <PowderRecordPage id={id} name={title} />
}
