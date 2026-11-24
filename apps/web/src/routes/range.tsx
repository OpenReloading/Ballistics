import { createFileRoute } from '@tanstack/react-router'
import { RangeMode } from '../components/range-mode.tsx'
import { pageHead } from './-page-head.ts'
import { searchOf } from './-search.ts'

export const Route = createFileRoute('/range')({
  validateSearch: searchOf('load', 'step', 'units'),
  head: () =>
    pageHead(
      'Range mode',
      'Enter chronograph velocities, conditions and notes for a saved load on a phone at the range, without a network; the entries stay in this browser.',
    ),
  component: RangeMode,
})
