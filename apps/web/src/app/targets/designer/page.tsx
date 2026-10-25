import type { Metadata } from 'next'
import { TargetDesignerLoader } from '../../../components/target-designer-loader.tsx'

export const metadata: Metadata = {
  title: 'Target face designer',
  description:
    'Enter the rings, inner ten, black area and events of a target face and see it drawn as you type. The face is kept in your browser and scores shots in the shot groups tool.',
}

export default function TargetDesignerPage() {
  return <TargetDesignerLoader />
}
