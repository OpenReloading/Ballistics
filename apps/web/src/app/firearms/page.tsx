import type { Metadata } from 'next'
import { FirearmLibrary } from '../../components/firearm-library.tsx'

export const metadata: Metadata = {
  title: 'Firearms',
  description:
    'Your firearms with their optics, sight configurations and zeros, kept in this browser and in files.',
}

export default function FirearmsPage() {
  return <FirearmLibrary />
}
