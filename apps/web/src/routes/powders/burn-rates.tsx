import { createFileRoute } from '@tanstack/react-router'
import {
  BurnRateCompare,
  BurnRatesLead,
  NoCurve,
  PowdersByBurnRate,
} from '../../components/burn-rate-compare.tsx'
import { PageBar } from '../../components/page-bar.tsx'
import { loadEnglish } from '../../i18n/lingui.ts'
import type { PowderSummary } from '../../lib/api-types.ts'
import { classifyPowder, isFitted, type UnfittedPowder } from '../../lib/burn-rate.ts'
import { manufacturerNames } from '../../lib/manufacturers.ts'
import englishMessages from '../../locales/en/routes/powders/burn-rates.json' with { type: 'json' }
import { readCatalogue } from '../-data.ts'
import { listHead } from '../-list-route.ts'
import { searchOf } from '../-search.ts'

loadEnglish(englishMessages)

export const Route = createFileRoute('/powders/burn-rates')({
  validateSearch: searchOf('add'),
  loader: async () => {
    const c = await readCatalogue()
    const names = manufacturerNames(c.manufacturers().items)
    // the page carries names only; the overlay fetches the burn law of each powder it shows
    const all = (c.powders().items as PowderSummary[]).map((p) => classifyPowder(p, names))
    const options = all
      .filter(isFitted)
      .map((p) => ({ value: p.id, label: p.label }))
      .sort((a, b) => a.label.localeCompare(b.label))
    return { options, unfitted: all.filter((p): p is UnfittedPowder => !isFitted(p)) }
  },
  head: () =>
    listHead(
      'Powder burn rates',
      'Dynamic vivacity curves of up to six powders, computed from fitted model parameters, not manufacturer data.',
    ),
  component: BurnRatesPage,
})

function BurnRatesPage() {
  const { options, unfitted } = Route.useLoaderData()
  return (
    <>
      <PageBar
        title={/*i18n*/ { id: 'page.powdersBurnRates', message: 'Powder burn rates' }}
        translated
        single
        actions={<PowdersByBurnRate />}
      />
      <BurnRatesLead />
      <BurnRateCompare options={options} />
      <NoCurve powders={unfitted} />
    </>
  )
}
