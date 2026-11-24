import { createFileRoute } from '@tanstack/react-router'
import { PowderTuneLoader } from '../../components/powder-tune-loader.tsx'
import { listHead, listSearch } from '../-list-route.ts'

export const Route = createFileRoute('/powders/tune')({
  validateSearch: listSearch,
  head: () =>
    listHead(
      'Tune a powder',
      'Chronograph strings of a saved load or typed in, with mean, standard deviation and shot count per charge, to fit a powder to.',
    ),
  component: PowderTuneLoader,
})
