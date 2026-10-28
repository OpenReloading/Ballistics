type Target = HTMLElement | string | null | undefined

/**
 * Puts the focus on the first control that shows, once the dialog or card that held it is gone
 * (the browser would drop it to the start of the page). A selector is looked up when the frame comes,
 * so a control the same render adds or shows is found; "Page actions" is the last target
 * where the control is in the phone panel, which is hidden again by then.
 */
export function focusBack(...targets: Target[]) {
  requestAnimationFrame(() => {
    for (const t of targets) {
      const el = typeof t === 'string' ? document.querySelector<HTMLElement>(t) : t
      if (!el || el.getClientRects().length === 0) continue
      el.focus()
      return
    }
  })
}
