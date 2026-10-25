import type { Metadata } from 'next'
import Link from 'next/link'
import { Suspense } from 'react'
import { BurnRateCompare } from '../../../components/burn-rate-compare.tsx'
import { PageBar } from '../../../components/page-bar.tsx'
import { Panel } from '../../../components/panel.tsx'
import { LinkButton } from '../../../components/record-actions.tsx'
import { Loading, ServerDataError } from '../../../components/states.tsx'
import { getManufacturerNames, listAllPowders } from '../../../lib/api.ts'
import {
  classifyPowder,
  isFitted,
  modelNote,
  type UnfittedPowder,
  unfitTitles,
  unfittedGroups,
} from '../../../lib/burn-rate.ts'

export const metadata: Metadata = {
  title: 'Powder burn rates',
  description:
    'Dynamic vivacity curves of up to six powders, computed from fitted model parameters, not manufacturer data.',
}

async function Compare() {
  const [list, names] = await Promise.all([listAllPowders(), getManufacturerNames()])
  if (list.status !== 'ok') return <ServerDataError what="Powder" />
  // the page carries names only; the overlay fetches the burn law of each powder it shows
  const all = list.data.map((p) => classifyPowder(p, names))
  const options = all
    .filter(isFitted)
    .map((p) => ({ value: p.id, label: p.label }))
    .sort((a, b) => a.label.localeCompare(b.label))
  const groups = unfittedGroups(all.filter((p): p is UnfittedPowder => !isFitted(p)))
  return (
    <>
      <BurnRateCompare options={options} />
      {groups.length > 0 && (
        <Panel id="no-curve" title="Without a curve" className="no-curve">
          {groups.map((g) => (
            <div key={g.kind}>
              <p>{unfitTitles[g.kind]}</p>
              <ul className="inline-list">
                {g.powders.map((p) => (
                  <li key={p.id}>
                    <Link href={`/powders/${p.id}`}>{p.label}</Link>
                    {p.detail && ` (${p.detail})`}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </Panel>
      )}
    </>
  )
}

export default function BurnRatesPage() {
  return (
    <>
      <PageBar
        title="Powder burn rates"
        single
        actions={<LinkButton href="/powders?sort=-rate">Powders by burn rate</LinkButton>}
      />
      <p className="muted page-lead">
        Dynamic vivacity, the burn rate per pressure, over burnt fraction.{' '}
        <span className="screen-only">{modelNote} </span>The interval scales the whole curve.
      </p>
      <Suspense fallback={<Loading what="powders" />}>
        <Compare />
      </Suspense>
    </>
  )
}
