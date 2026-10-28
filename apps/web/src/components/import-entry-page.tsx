'use client'

import dynamic from 'next/dynamic'
import { useSearchParams } from 'next/navigation'

const A = dynamic(() => import('./import-entry-a.tsx'), { ssr: false })
const B = dynamic(() => import('./import-entry-b.tsx'), { ssr: false })

/** The prototype's route: `?layout=a` (default) or `?layout=b`. */
export function ImportEntryPage() {
  return useSearchParams().get('layout') === 'b' ? <B /> : <A />
}
