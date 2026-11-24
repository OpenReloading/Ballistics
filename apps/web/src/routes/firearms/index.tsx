import { createFileRoute } from '@tanstack/react-router'
import { FirearmLibrary } from '../../components/firearm-library.tsx'
import { listHead, listSearch } from '../-list-route.ts'

export const Route = createFileRoute('/firearms/')({
  validateSearch: listSearch,
  head: () =>
    listHead(
      'Firearms',
      'Your firearms with their optics, sight configurations and zeros, kept in this browser and in files.',
    ),
  component: FirearmLibrary,
})
