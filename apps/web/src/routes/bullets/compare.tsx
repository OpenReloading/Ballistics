import { ClientOnly, createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { CompareBar, CompareView } from '../../components/bullet-compare-view.tsx'
import { Loading } from '../../components/states.tsx'
import { listHead } from '../-list-route.ts'

export const Route = createFileRoute('/bullets/compare')({
  // the router reads `?ids=308` as a number; a value that is no list of ids reads as none
  validateSearch: z.object({
    ids: z
      .union([z.string(), z.number().transform(String)])
      .optional()
      .catch(undefined),
  }),
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
