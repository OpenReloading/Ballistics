import type { Metadata } from 'next'
import { Suspense } from 'react'
import { CompareBar, CompareView } from '../../../components/bullet-compare-view.tsx'
import { Loading } from '../../../components/states.tsx'

export const metadata: Metadata = {
  title: 'Compare bullets',
  description: 'Two to four bullets side by side: dimensions, ballistic coefficients and drawings.',
}

export default function BulletComparePage() {
  return (
    <div className="compare-view">
      {/* the ids are in the URL only: the bar is the static shell, the table renders in the browser */}
      <Suspense
        fallback={
          <>
            <CompareBar actions={false} />
            <Loading what="bullets" />
          </>
        }
      >
        <CompareView />
      </Suspense>
    </div>
  )
}
