type Target = HTMLElement | string | null | undefined

/** Once the dialog or card that held the focus is gone, as the browser would drop it to the page start; selectors are looked up in the next frame, so a control the same render adds is found; "Page actions" last, for a control in the phone panel, hidden by then. */
export function focusBack(...targets: Target[]) {
  focusLater(false, targets)
}

/** `focusBack` only while the focus is still lost when the frame comes: a field focused meanwhile keeps it. */
export function focusIfLost(...targets: Target[]) {
  focusLater(true, targets)
}

function focusLater(ifLost: boolean, targets: Target[]) {
  requestAnimationFrame(() => {
    if (ifLost && document.activeElement && document.activeElement !== document.body) return
    for (const t of targets) {
      const el = typeof t === 'string' ? document.querySelector<HTMLElement>(t) : t
      if (!el || el.getClientRects().length === 0) continue
      el.focus()
      return
    }
  })
}
