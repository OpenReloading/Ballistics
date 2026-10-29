import type { Metadata } from 'next'
import { CaseGroupEditor } from '../../../components/case-group-editor.tsx'

export const metadata: Metadata = {
  title: 'Brass group',
  description:
    'A group of your cases with their measured water capacity, trim length and neck wall, kept in this browser and in files.',
}

export default function CaseGroupPage() {
  return <CaseGroupEditor />
}
