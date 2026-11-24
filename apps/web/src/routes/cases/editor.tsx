import { createFileRoute } from '@tanstack/react-router'
import { CaseGroupEditor } from '../../components/case-group-editor.tsx'
import { listHead, listSearch } from '../-list-route.ts'

export const Route = createFileRoute('/cases/editor')({
  validateSearch: listSearch,
  head: () =>
    listHead(
      'Brass group',
      'A group of your cases with their measured water capacity, trim length and neck wall, kept in this browser and in files.',
    ),
  component: CaseGroupEditor,
})
