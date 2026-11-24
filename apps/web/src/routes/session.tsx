import { createFileRoute } from '@tanstack/react-router'
import { SessionSummary } from '../components/session-summary.tsx'
import { listHead } from './-list-route.ts'
import { searchOf } from './-search.ts'

export const Route = createFileRoute('/session')({
  validateSearch: searchOf('units'),
  head: () =>
    listHead(
      'Session summary',
      'Summary of one chronograph session from an exported file, read in the browser: shots and statistics per string.',
    ),
  component: SessionSummary,
})
