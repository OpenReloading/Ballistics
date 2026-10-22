'use client'

import { createSpotlight } from '@mantine/spotlight'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { productLabel } from '../lib/manufacturers.ts'
import { useManufacturerNames } from './use-manufacturer-names.ts'
import { WorkbenchSearch } from './workbench-search.tsx'

const search = createSpotlight()

/**
 * The site search of every page but the workbench: pages, the shell's commands and records,
 * a record opening its page. Loaded when it is first asked for (`SiteHeader`); each new `request`
 * opens it.
 */
export function SiteSearch({ request }: { request: number }) {
  const router = useRouter()
  const names = useManufacturerNames()
  // biome-ignore lint/correctness/useExhaustiveDependencies: each request opens it once
  useEffect(() => search[1].open(), [request])
  return (
    <WorkbenchSearch
      search={search}
      commands={[]}
      onCartridge={(c) => router.push(`/cartridges/${c.id}`)}
      onBullet={(b) => router.push(`/bullets/${b.id}`)}
      onPowder={(p) => router.push(`/powders/${p.id}`)}
      describeBullet={(b) => productLabel(b, names)}
      bulletsLabel="Bullets"
    />
  )
}
