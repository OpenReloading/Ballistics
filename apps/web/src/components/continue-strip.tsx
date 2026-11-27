'use client'

import { useLingui } from '@lingui/react'
import { useEffect, useState } from 'react'
import Link from '@/platform/link.tsx'
import { loadEnglish } from '../i18n/lingui.ts'
import { openOnWorkbench, type RecentLoad, recentLoads } from '../lib/open-loads.ts'
import englishMessages from '../locales/en/components/continue-strip.json' with { type: 'json' }

loadEnglish(englishMessages)

const label = /*i18n*/ { id: 'continueStrip.label', message: 'Continue' }

/** One line of fixed height from the first render, so the cards below never move. */
export function ContinueStrip() {
  const { i18n } = useLingui()
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
    <nav className="home-continue screen-only" aria-label={i18n._(label)}>
      {loads?.length === 0 && (
        <p>{i18n._({ id: 'continueStrip.empty', message: 'Loads you save show here.' })}</p>
      )}
      {loads && loads.length > 0 && (
        <>
          <span>{i18n._(label)}</span>
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
