import type { Metadata } from 'next'
import { NotFoundState } from '../components/offline-state.tsx'
import { PageBar } from '../components/page-bar.tsx'
import { sections } from '../lib/sections.ts'

export const metadata: Metadata = { title: 'Page not found' }

export default function NotFound() {
  return (
    <>
      <PageBar title="Page not found" />
      <NotFoundState
        links={sections.flatMap((s): readonly { href: string; label: string }[] => s.pages)}
      />
    </>
  )
}
