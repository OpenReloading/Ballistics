import { ClientOnly, createFileRoute } from '@tanstack/react-router'
import { NotFoundPage } from './-not-found.tsx'

// a splat route, as the root's notFoundComponent fails hydration on the shell until TanStack/router#8473 closes
export const Route = createFileRoute('/$')({
  // the shell holds this match as an empty Suspense boundary; the client renders the same until it has hydrated, also when the match has loaded first
  wrapInSuspense: true,
  component: NotFoundRoute,
})

function NotFoundRoute() {
  return (
    <ClientOnly>
      <NotFoundPage />
    </ClientOnly>
  )
}
