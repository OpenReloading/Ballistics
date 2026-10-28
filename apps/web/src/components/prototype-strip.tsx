'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { dayText } from '../lib/dates.ts'
import { type LoadRecord, openLoadsKey, openLoadsText, parseOpenLoads } from '../lib/load-tabs.ts'
import { storedRecords } from '../lib/user-store.ts'

type State = 'reading' | 'empty' | LoadRecord[]

/** Opens the load as the workbench's own tab set does, then the link goes to the workbench. */
function openLoad(id: string) {
  try {
    const open = parseOpenLoads(localStorage.getItem(openLoadsKey))
    localStorage.setItem(
      openLoadsKey,
      openLoadsText({ ids: [...new Set([...open.ids, id])], active: id }),
    )
  } catch {}
}

/**
 * The three most recently saved loads of this browser. Its box keeps one line's height while the
 * store is read; with nothing saved it shows a hint of that height, or (`collapse`) gives the
 * height back, which shifts the page.
 */
export function ContinueStrip({ collapse = false }: { collapse?: boolean }) {
  const [state, setState] = useState<State>('reading')
  useEffect(() => {
    storedRecords()
      .then(({ records }) => {
        const loads = records
          .filter((r): r is LoadRecord => r.kind === 'load')
          .sort((a, b) => (a.saved < b.saved ? 1 : -1))
          .slice(0, 3)
        setState(loads.length > 0 ? loads : 'empty')
      })
      .catch(() => setState('empty'))
  }, [])
  const hidden = collapse && state === 'empty'
  return (
    <nav
      aria-label="Continue"
      className="home-strip"
      data-state={Array.isArray(state) ? 'filled' : state}
      hidden={hidden}
    >
      {Array.isArray(state) ? (
        <>
          <span className="home-strip-label">Continue</span>
          <ul>
            {state.map((r) => (
              <li key={r.id}>
                <Link href="/workbench" onClick={() => openLoad(r.id)}>
                  {r.name}
                </Link>{' '}
                <span className="home-count">{dayText(r.saved.slice(0, 10))}</span>
              </li>
            ))}
          </ul>
        </>
      ) : state === 'empty' ? (
        <span className="home-count">Loads you save appear here.</span>
      ) : null}
    </nav>
  )
}
