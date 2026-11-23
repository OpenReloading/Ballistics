import { type ComponentType, lazy, type ReactNode, Suspense, useSyncExternalStore } from 'react'

const none = () => () => {}

/** `next/dynamic` in the Start build, client-only as every call passes `ssr: false`: `loading` until hydrated and loaded. */
export default function dynamic<P extends object>(
  load: () => Promise<ComponentType<P>>,
  { loading }: { loading?: () => ReactNode } = {},
) {
  const Loaded = lazy(() => load().then((component) => ({ default: component })))
  const fallback = loading?.() ?? null
  return function Dynamic(props: P) {
    const hydrated = useSyncExternalStore(
      none,
      () => true,
      () => false,
    )
    if (!hydrated) return fallback
    return (
      <Suspense fallback={fallback}>
        <Loaded {...props} />
      </Suspense>
    )
  }
}
