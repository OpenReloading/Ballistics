import { createRouter } from '@tanstack/react-router'
import { PageError } from './routes/-error.tsx'
import { routeTree } from './routeTree.gen.ts'

export function getRouter() {
  return createRouter({
    routeTree,
    trailingSlash: 'always',
    scrollRestoration: true,
    defaultErrorComponent: PageError,
  })
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
