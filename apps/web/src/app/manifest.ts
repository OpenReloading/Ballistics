import type { MetadataRoute } from 'next'
import { basePath } from '../lib/edition.ts'

/** The web app manifest; the logo is full-bleed, so it is maskable too. */
export default function manifest(): MetadataRoute.Manifest {
  const icons = [
    { src: `${basePath}/icon-192.png`, sizes: '192x192', type: 'image/png' },
    { src: `${basePath}/icon.png`, sizes: '512x512', type: 'image/png' },
  ]
  return {
    name: 'OpenReloading Ballistics',
    short_name: 'OpenReloading',
    description: 'A ballistics database with interior and exterior ballistics simulations.',
    id: `${basePath}/`,
    start_url: `${basePath}/`,
    scope: `${basePath}/`,
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#ffffff',
    icons: [
      ...icons.map((i) => ({ ...i, purpose: 'any' as const })),
      ...icons.map((i) => ({ ...i, purpose: 'maskable' as const })),
    ],
  }
}

// the marker a static export needs on a route handler (Cache Components rejects `dynamic`)
export const generateStaticParams = () => [{}]
