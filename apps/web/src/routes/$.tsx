import { createFileRoute } from '@tanstack/react-router'
import { NotFoundPage } from './-not-found.tsx'

// a splat route, as the root's notFoundComponent fails hydration on the shell until TanStack/router#8473 closes
export const Route = createFileRoute('/$')({
  // hydration then renders the empty ClientOnly fallback the shell holds, also when this chunk and its load finish first
  ssr: false,
  component: NotFoundPage,
})
