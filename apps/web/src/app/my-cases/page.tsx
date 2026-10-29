import type { Metadata } from 'next'
import { MyCasesRedirect } from '../../components/my-cases-redirect.tsx'
import { PageBar } from '../../components/page-bar.tsx'

export const metadata: Metadata = { title: 'Brass', robots: { index: false } }

export default function MyCasesPage() {
  return (
    <>
      <PageBar title="Brass" />
      <MyCasesRedirect />
    </>
  )
}
