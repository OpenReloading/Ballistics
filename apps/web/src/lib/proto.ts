import { useSyncExternalStore } from 'react'

/** Throwaway prototype flag of #827: `?proto=a|b|c` picks a layout of the published load rows; none in the normal workbench. */
const layouts = ['a', 'b', 'c'] as const
export type ProtoLayout = (typeof layouts)[number]

const search = () => window.location.search
const never = () => () => {}

export function useProto(): ProtoLayout | undefined {
  const query = useSyncExternalStore(never, search, () => '')
  return layouts.find((l) => l === new URLSearchParams(query).get('proto'))
}
