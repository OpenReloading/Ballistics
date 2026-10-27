import type { Metadata } from 'next'
import { RangeMode } from '../../components/range-mode.tsx'

export const metadata: Metadata = {
  title: 'Range mode',
  description:
    'Enter chronograph velocities, conditions and notes for a saved load on a phone at the range, without a network; the entries stay in this browser.',
}

export default function RangePage() {
  return <RangeMode />
}
