import { createFileRoute } from '@tanstack/react-router'
import { FirearmLibrary } from '../../components/firearm-library.tsx'
import { listHead } from '../-list-route.ts'
import { searchOf } from '../-search.ts'

export const Route = createFileRoute('/firearms/')({
  validateSearch: searchOf('record'),
  head: () =>
    listHead(
      'Firearms',
      'Your firearms with their optics, sight configurations and zeros, kept in this browser and in files.',
    ),
  component: FirearmLibrary,
})
