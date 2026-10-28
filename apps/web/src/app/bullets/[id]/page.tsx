import type { Metadata, ResolvingMetadata } from 'next'
import { notFound } from 'next/navigation'
import { BulletRecordPage } from '../../../components/bullet-record-page.tsx'
import { ServerDataError } from '../../../components/states.tsx'
import {
  getBullet,
  getManufacturerNames,
  listAllBullets,
  listAllCartridges,
  staticIds,
} from '../../../lib/api.ts'
import { fitsOf } from '../../../lib/bullet-fit.ts'
import { recordHeadText, recordMetadata } from '../../../lib/record-metadata.ts'

export function generateStaticParams() {
  return staticIds(listAllBullets, 'bullet')
}

export async function generateMetadata(
  { params }: PageProps<'/bullets/[id]'>,
  parent: ResolvingMetadata,
): Promise<Metadata> {
  const { id } = await params
  const r = await getBullet(id)
  if (r.status === 'notFound') notFound()
  if (r.status !== 'ok') return { robots: { index: false } }
  const { title, description } = recordHeadText('bullets', r.data, await getManufacturerNames())
  return recordMetadata(parent, title, description)
}

// no Suspense above notFound(): a streamed response keeps status 200
export default async function BulletPage({ params }: PageProps<'/bullets/[id]'>) {
  const { id } = await params
  const r = await getBullet(id)
  if (r.status === 'notFound') notFound()
  if (r.status !== 'ok') return <ServerDataError what="Bullet" />
  const [names, cartridges] = await Promise.all([getManufacturerNames(), listAllCartridges()])
  const fits = cartridges.status === 'ok' ? fitsOf(r.data.diameter.value, cartridges.data) : []
  return (
    <BulletRecordPage id={id} name={recordHeadText('bullets', r.data, names).title} fits={fits} />
  )
}
