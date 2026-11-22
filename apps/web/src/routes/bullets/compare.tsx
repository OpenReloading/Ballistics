import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { PlaceholderPage } from '../-placeholder.tsx'

export const Route = createFileRoute('/bullets/compare')({
  // the router reads `?ids=308` as a number; a value that is no list of ids reads as none
  validateSearch: z.object({
    ids: z
      .union([z.string(), z.number().transform(String)])
      .optional()
      .catch(undefined),
  }),
  component: PlaceholderPage,
})
