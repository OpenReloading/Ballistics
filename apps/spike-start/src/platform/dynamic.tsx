// Stands in for `next/dynamic` with `ssr: false`: React.lazy inside ClientOnly, `loading` before and while it loads.
import { ClientOnly } from '@tanstack/react-router'
import { type ComponentType, lazy, type ReactNode, Suspense } from 'react'

type Loaded<P> = ComponentType<P> | { default: ComponentType<P> }

type Options = {
  ssr?: boolean
  loading?: (props: { isLoading?: boolean; pastDelay?: boolean; error?: Error | null }) => ReactNode
}

export default function dynamic<P extends object>(
  loader: () => Promise<Loaded<P>>,
  options: Options = {},
): ComponentType<P> {
  const Lazy = lazy(() =>
    loader().then((m) => ({
      default:
        typeof m === 'object' && m !== null && 'default' in m ? m.default : (m as ComponentType<P>),
    })),
  )
  const fallback = options.loading?.({ isLoading: true, pastDelay: true, error: null }) ?? null
  function Dynamic(props: P) {
    const content = (
      <Suspense fallback={fallback}>
        <Lazy {...props} />
      </Suspense>
    )
    return options.ssr === false ? <ClientOnly fallback={fallback}>{content}</ClientOnly> : content
  }
  return Dynamic
}
