import type { Metadata } from 'next'
import { TargetEditor } from '../../components/target-editor.tsx'

export const metadata: Metadata = {
  title: 'Shot groups',
  description:
    'Shot groups on a target photo or a drawn target: calibration with perspective, shots, points of aim and group statistics, kept in this browser.',
}

export default function GroupsPage() {
  return (
    <div className="groups-page">
      <TargetEditor heading="Shot groups" />
    </div>
  )
}
