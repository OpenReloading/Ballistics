import { createFileRoute } from '@tanstack/react-router'
import { TargetDesignerLoader } from '../../components/target-designer-loader.tsx'
import { listHead } from '../-list-route.ts'
import { searchOf } from '../-search.ts'

export const Route = createFileRoute('/targets/designer')({
  validateSearch: searchOf('record'),
  head: () =>
    listHead(
      'Target designer',
      'Enter the rings, inner ten, black area and events of a target and see it drawn as you type. The target is kept in your browser and scores shots in the shot groups tool.',
    ),
  component: TargetDesignerLoader,
})
