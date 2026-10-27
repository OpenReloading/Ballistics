import type { ReactNode } from 'react'

// an id not prerendered waits for its render instead of a streamed shell, so notFound() gives 404
// (server edition only: `.server.tsx`, see next.config.ts)
export const ensureStatic = 'navigation'

export default function RecordLayout({ children }: { children: ReactNode }) {
  return children
}
