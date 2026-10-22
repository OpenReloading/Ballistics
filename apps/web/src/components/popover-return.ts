import { useEffect, useRef } from 'react'

/**
 * A point tool started from a control in a popover: once the tool ends (`tool` back to `select`),
 * `reopen` opens the popover again and the focus goes back to the control `find` gives for the
 * name passed to the returned function when the tool started.
 */
export function usePopoverReturn(
  tool: string,
  reopen: () => void,
  find: (which: string) => HTMLElement | null | undefined,
) {
  const from = useRef<string | undefined>(undefined)
  // biome-ignore lint/correctness/useExhaustiveDependencies: on a tool change only
  useEffect(() => {
    if (tool !== 'select' || !from.current) return
    const which = from.current
    from.current = undefined
    reopen()
    // the dropdown mounts after this render: a few frames at most
    let frames = 0
    const focus = () => {
      const el = find(which)
      el?.focus()
      if (document.activeElement !== el && ++frames < 30) requestAnimationFrame(focus)
    }
    requestAnimationFrame(focus)
  }, [tool])
  return (which: string) => {
    from.current = which
  }
}
