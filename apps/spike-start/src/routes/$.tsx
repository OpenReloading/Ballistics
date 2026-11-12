import { createFileRoute } from '@tanstack/react-router'
import { NotFound } from '../not-found.tsx'

// an unknown path is a code-split route, not the root's notFoundComponent: on the shell the latter hydrates
// against an empty route area (TanStack/router#8473)
export const Route = createFileRoute('/$')({ component: NotFound })
