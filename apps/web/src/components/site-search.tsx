'use client'

import { createSpotlight } from '@mantine/spotlight'
import { useEffect, useMemo } from 'react'
import { useRouter } from '@/platform/navigation.ts'
import { useTranslation } from '../i18n/language.ts'
import { productLabel } from '../lib/manufacturers.ts'
import { designerHref, userBulletRows } from '../lib/sources.ts'
import { userBullets } from '../lib/variants.ts'
import { useResolved, useUserRecords } from './list-sources.tsx'
import { useManufacturerNames } from './use-manufacturer-names.ts'
import { WorkbenchSearch } from './workbench-search.tsx'

const search = createSpotlight()

/** The browser's bullet designs are read again at each opening and open their designer; loaded when first asked for (`SiteHeader`), each new `request` opens it. */
export function SiteSearch({ request }: { request: number }) {
  const router = useRouter()
  const { t } = useTranslation()
  const names = useManufacturerNames()
  const [records] = useUserRecords(request)
  const mine = useResolved(records, userBullets)
  const designs = useMemo(() => userBulletRows(mine), [mine])
  useEffect(() => search[1].open(), [request])
  return (
    <WorkbenchSearch
      search={search}
      commands={[]}
      onCartridge={(c) => router.push(`/cartridges/${c.id}`)}
      onBullet={(b) =>
        router.push(b.origin === 'user' ? designerHref('bullets', b.id) : `/bullets/${b.id}`)
      }
      onPowder={(p) => router.push(`/powders/${p.id}`)}
      describeBullet={(b) => productLabel(b, names)}
      bulletsLabel={t('Bullets')}
      designs={designs}
    />
  )
}
