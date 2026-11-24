import { createFileRoute } from '@tanstack/react-router'
import { ShootingLog } from '../../components/shooting-log.tsx'
import { listHead } from '../-list-route.ts'
import { searchOf } from '../-search.ts'

export const Route = createFileRoute('/firearms/log')({
  validateSearch: searchOf('record', 'firearm', 'year'),
  head: () =>
    listHead(
      'Shooting log',
      'Your range days with firearm, load, rounds and result, kept in this browser; print a year or a date range, export CSV and JSON.',
    ),
  component: ShootingLog,
})
