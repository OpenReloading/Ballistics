import type { Metadata } from 'next'
import { OfflineState } from '../../components/offline-state.tsx'

export const metadata: Metadata = { title: 'Offline', robots: { index: false } }

/** The service worker's answer for a page never opened on this device while offline. */
export default function Offline() {
  return <OfflineState />
}
