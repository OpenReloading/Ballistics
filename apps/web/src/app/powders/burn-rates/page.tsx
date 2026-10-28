import type { Metadata } from 'next'
import { Suspense } from 'react'
import {
  BurnRateCompare,
  BurnRatesLead,
  NoCurve,
  PowdersByBurnRate,
} from '../../../components/burn-rate-compare.tsx'
import { PageBar } from '../../../components/page-bar.tsx'
import { Loading, ServerDataError } from '../../../components/states.tsx'
import { msg } from '../../../i18n/translate.ts'
import { getManufacturerNames, listAllPowders } from '../../../lib/api.ts'
import { classifyPowder, isFitted, type UnfittedPowder } from '../../../lib/burn-rate.ts'

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
  return (
    <>
      <BurnRateCompare options={options} />
      <NoCurve powders={all.filter((p): p is UnfittedPowder => !isFitted(p))} />
    </>
  )
}

export default function BurnRatesPage() {
  return (
    <>
      <PageBar title={msg('Powder burn rates')} translated single actions={<PowdersByBurnRate />} />
      <BurnRatesLead />
      <Suspense fallback={<Loading what="powders" />}>
        <Compare />
      </Suspense>
    </>
  )
}
