import { createFileRoute } from '@tanstack/react-router'
import { ShootingLog } from '../../components/shooting-log.tsx'
import { listHead, listSearch } from '../-list-route.ts'

export const Route = createFileRoute('/firearms/log')({
  validateSearch: listSearch,
  head: () =>
    listHead(
      'Shooting log',
      'Your range days with firearm, load, rounds and result, kept in this browser; print a year or a date range, export CSV and JSON.',
    ),
  component: ShootingLog,
})
