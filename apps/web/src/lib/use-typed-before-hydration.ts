import { useLayoutEffect, useRef } from 'react'

/** Takes what was typed into the named controlled fields before hydration into their state, which would overwrite it at the next render. */
export function useTypedBeforeHydration(setters: Record<string, (value: string) => void>) {
  const first = useRef(setters)
  useLayoutEffect(() => {
    for (const [name, set] of Object.entries(first.current)) {
      const field = document.querySelector<HTMLInputElement | HTMLTextAreaElement>(
        `[name="${name}"]`,
      )
      if (field) set(field.value)
    }
  }, [])
}
