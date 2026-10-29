import type { Metadata } from 'next'
import { TargetDesignerLoader } from '../../../components/target-designer-loader.tsx'

export const metadata: Metadata = {
  title: 'Target designer',
  description:
    'Enter the rings, inner ten, black area and events of a target and see it drawn as you type. The target is kept in your browser and scores shots in the shot groups tool.',
}

export default function TargetDesignerPage() {
  return <TargetDesignerLoader />
}
