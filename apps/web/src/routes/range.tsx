import { createFileRoute } from '@tanstack/react-router'
import { RangeMode } from '../components/range-mode.tsx'
import { listHead } from './-list-route.ts'
import { searchOf } from './-search.ts'

export const Route = createFileRoute('/range')({
  validateSearch: searchOf('load', 'step', 'units'),
  head: () =>
    listHead(
      'Range mode',
      'Enter chronograph velocities, conditions and notes for a saved load on a phone at the range, without a network; the entries stay in this browser.',
    ),
  component: RangeMode,
})
