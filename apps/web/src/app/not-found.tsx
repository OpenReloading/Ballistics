import type { Metadata } from 'next'
import { PageNotFound } from '../components/page-not-found.tsx'

export const metadata: Metadata = { title: 'Page not found' }

export default function NotFound() {
  return <PageNotFound />
}
