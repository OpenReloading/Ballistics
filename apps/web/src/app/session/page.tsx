import type { Metadata } from 'next'
import { SessionSummary } from '../../components/session-summary.tsx'

export const metadata: Metadata = {
  title: 'Session summary',
  description:
    'Summary of one chronograph session from an exported file, read in the browser: shots and statistics per string.',
}

export default function SessionPage() {
  return <SessionSummary />
}
