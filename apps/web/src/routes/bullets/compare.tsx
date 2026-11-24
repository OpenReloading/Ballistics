import { ClientOnly, createFileRoute } from '@tanstack/react-router'
import { CompareBar, CompareView } from '../../components/bullet-compare-view.tsx'
import { Loading } from '../../components/states.tsx'
import { listHead } from '../-list-route.ts'
import { searchOf } from '../-search.ts'

export const Route = createFileRoute('/bullets/compare')({
  validateSearch: searchOf('ids'),
  head: () =>
    listHead(
      'Compare bullets',
      'Two to four bullets side by side: dimensions, ballistic coefficients and drawings.',
    ),
  component: BulletComparePage,
})

function BulletComparePage() {
  return (
    <div className="compare-view">
      {/* the ids are in the URL only: the bar is the prerendered shell, the table renders in the browser */}
      <ClientOnly
        fallback={
          <>
            <CompareBar actions={false} />
            <Loading what="bullets" />
          </>
        }
      >
        <CompareView />
      </ClientOnly>
    </div>
  )
}
