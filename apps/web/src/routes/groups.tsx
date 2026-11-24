import { createFileRoute } from '@tanstack/react-router'
import { TargetEditor } from '../components/target-editor.tsx'
import { msg } from '../i18n/translate.ts'
import { pageHead } from './-page-head.ts'
import { searchOf } from './-search.ts'

/** The groups of `TargetEditor`, which opens a new sheet on the face and event of the address. */
function GroupsPage() {
  return (
    <div className="groups-page">
      <TargetEditor heading={msg('Shot groups')} />
    </div>
  )
}

export const Route = createFileRoute('/groups')({
  validateSearch: searchOf('face', 'event', 'units'),
  head: () =>
    pageHead(
      'Shot groups',
      'Shot groups on a target photo or a drawn target: calibration with perspective, shots, points of aim and group statistics, kept in this browser.',
    ),
  component: GroupsPage,
})
