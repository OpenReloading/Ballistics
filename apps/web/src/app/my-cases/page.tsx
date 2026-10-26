import type { Metadata } from 'next'
import { CaseLibrary } from '../../components/case-library.tsx'

export const metadata: Metadata = {
  title: 'My cases',
  description:
    'Your groups of cases with their measured water capacity, trim length and neck wall, kept in this browser and in files.',
}

export default function MyCasesPage() {
  return <CaseLibrary />
}
