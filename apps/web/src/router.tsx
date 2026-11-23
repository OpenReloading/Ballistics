import { createRouter } from '@tanstack/react-router'
import { LoadFailedPage } from './routes/-not-found.tsx'
import { routeTree } from './routeTree.gen.ts'

export function getRouter() {
  return createRouter({
    routeTree,
    trailingSlash: 'always',
    scrollRestoration: true,
    defaultErrorComponent: LoadFailedPage,
  })
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
