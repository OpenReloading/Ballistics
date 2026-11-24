import { createFileRoute } from '@tanstack/react-router'
import { TargetDesignerLoader } from '../../components/target-designer-loader.tsx'
import { listHead, listSearch } from '../-list-route.ts'

export const Route = createFileRoute('/targets/designer')({
  validateSearch: listSearch,
  head: () =>
    listHead(
      'Target designer',
      'Enter the rings, inner ten, black area and events of a target and see it drawn as you type. The target is kept in your browser and scores shots in the shot groups tool.',
    ),
  component: TargetDesignerLoader,
})
