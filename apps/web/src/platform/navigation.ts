import { useLocation, useRouter as useStartRouter } from '@tanstack/react-router'
import { useMemo } from 'react'
import { whenAllowed } from '../lib/navigation-guard.ts'

/** The path below the base path. */
export const usePathname = () => useLocation({ select: (location) => location.pathname })

export function useSearchParams() {
  const search = useLocation({ select: (location) => location.searchStr })
  return useMemo(() => new URLSearchParams(search), [search])
}

/** The methods the views call; `push` and `replace` ask the navigation guard's questions first, `refresh` runs the loaders again. */
export function useRouter() {
  const router = useStartRouter()
  return useMemo(
    () => ({
      push: (href: string) => whenAllowed(() => void router.navigate({ href })),
      replace: (href: string) => whenAllowed(() => void router.navigate({ href, replace: true })),
      back: () => router.history.back(),
      refresh: () => void router.invalidate(),
    }),
    [router],
  )
}
