import { useEffect, useSyncExternalStore } from 'react'

/** Throwaway prototype flag of the input bar: `?proto=a..e` picks a layout, `?run=auto` the Run area that recalculates itself. */
const layouts = ['a', 'b', 'c', 'd', 'e'] as const
export type ProtoLayout = (typeof layouts)[number]

/** Layouts A and E: every field of a card visible, one row grid, the record values as read-only rows. */
export const dense = (l: ProtoLayout | undefined) => l === 'a' || l === 'e'

const search = () => window.location.search
const never = () => () => {}

export function useProto(
  stale = false,
  pending = false,
  run?: () => void,
): { layout: ProtoLayout | undefined; auto: boolean; className: string } {
  const query = useSyncExternalStore(never, search, () => '')
  const params = new URLSearchParams(query)
  const layout = layouts.find((l) => l === params.get('proto'))
  const auto = params.get('run') === 'auto'
  // the Run area without a button press: a changed input runs once typing pauses
  useEffect(() => {
    document.documentElement.dataset.protoRun = auto ? 'auto' : ''
    if (!auto || !stale || pending || !run) return
    const id = setTimeout(run, 800)
    return () => clearTimeout(id)
  }, [auto, stale, pending, run])
  return { layout, auto, className: layout ? `workbench proto-${layout}` : 'workbench' }
}
