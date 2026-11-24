import { createFileRoute } from '@tanstack/react-router'
import { PowderTuneLoader } from '../../components/powder-tune-loader.tsx'
import { listHead } from '../-list-route.ts'
import { searchOf } from '../-search.ts'

export const Route = createFileRoute('/powders/tune')({
  validateSearch: searchOf('powder', 'session'),
  head: () =>
    listHead(
      'Tune a powder',
      'Chronograph strings of a saved load or typed in, with mean, standard deviation and shot count per charge, to fit a powder to.',
    ),
  component: PowderTuneLoader,
})
