import type { Metadata } from 'next'
import { ShootingLog } from '../../../components/shooting-log.tsx'

export const metadata: Metadata = {
  title: 'Shooting log',
  description:
    'Your range days with firearm, load, rounds and result, kept in this browser; print a year or a date range, export CSV and JSON.',
}

export default function ShootingLogPage() {
  return <ShootingLog />
}
