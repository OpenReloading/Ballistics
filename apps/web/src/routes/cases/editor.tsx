import { createFileRoute } from '@tanstack/react-router'
import { CaseGroupEditor } from '../../components/case-group-editor.tsx'
import { listHead } from '../-list-route.ts'
import { searchOf } from '../-search.ts'

export const Route = createFileRoute('/cases/editor')({
  validateSearch: searchOf('record'),
  head: () =>
    listHead(
      'Brass group',
      'A group of your cases with their measured water capacity, trim length and neck wall, kept in this browser and in files.',
    ),
  component: CaseGroupEditor,
})
