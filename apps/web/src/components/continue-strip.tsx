'use client'

import { useEffect, useState } from 'react'
import Link from '@/platform/link.tsx'
import { useTranslation } from '../i18n/language.ts'
import { openOnWorkbench, type RecentLoad, recentLoads } from '../lib/open-loads.ts'

/** One line of fixed height from the first render, so the cards below never move. */
export function ContinueStrip() {
  const { t } = useTranslation()
  const [loads, setLoads] = useState<RecentLoad[]>()
  useEffect(() => {
    let alive = true
    recentLoads().then(
      (r) => alive && setLoads(r),
      () => alive && setLoads([]),
    )
    return () => {
      alive = false
    }
  }, [])
  return (
    <nav className="home-continue screen-only" aria-label={t('Continue')}>
      {loads?.length === 0 && <p>{t('Loads you save show here.')}</p>}
      {loads && loads.length > 0 && (
        <>
          <span>{t('Continue')}</span>
          <ul>
            {loads.map((r) => (
              <li key={r.id}>
                <Link href="/workbench" title={r.name} onClick={() => openOnWorkbench(r.id)}>
                  {r.name}
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </nav>
  )
}
