import { ClientOnly, createFileRoute, useMatch } from '@tanstack/react-router'
import { NotFoundPage } from './-not-found.tsx'

// a splat route, as the root's notFoundComponent fails hydration on the shell until TanStack/router#8473 closes
export const Route = createFileRoute('/$')({
  // the shell holds this match as an empty Suspense boundary; the client renders the same until it has hydrated
  wrapInSuspense: true,
  component: NotFoundRoute,
})

function NotFoundRoute() {
  const match = useMatch({ from: '/$' })
  console.warn(
    `DIAG2 ${JSON.stringify({ routeSsr: Route.options.ssr ?? 'undef', matchSsr: match.ssr ?? 'undef', status: match.status })}`,
  )
  return (
    <ClientOnly>
      <NotFoundPage />
    </ClientOnly>
  )
}
