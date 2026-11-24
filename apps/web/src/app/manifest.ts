import type { MetadataRoute } from 'next'
import { basePath } from '../lib/edition.ts'
import { webManifest } from '../lib/web-manifest.ts'

export default function manifest(): MetadataRoute.Manifest {
  return webManifest(basePath)
}

// the marker a static export needs on a route handler (Cache Components rejects `dynamic`)
export const generateStaticParams = () => [{}]
