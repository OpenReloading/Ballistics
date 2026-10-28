import type { Locator } from '@playwright/test'

/** A keyboard stop: its name and its place in the visual order, `[block, y, x]`. */
export type Stop = { name: string; key: number[] }

/**
 * The steps of `stops` that go back in the visual order: to an earlier block, or in one block to a
 * line above, or on one line to the left. Centres within 8 px count as one line.
 */
export function inversions(stops: Stop[]) {
  const back = (a: number[], b: number[]) => {
    for (let i = 0; i < a.length; i++) {
      if (i === 1 && Math.abs((a[1] ?? 0) - (b[1] ?? 0)) <= 8) continue
      if ((a[i] ?? 0) !== (b[i] ?? 0)) return (b[i] ?? 0) < (a[i] ?? 0)
    }
    return false
  }
  return stops.flatMap((s, i) => {
    const prev = stops[i - 1]
    return prev && back(prev.key, s.key) ? [`${prev.name} -> ${s.name}`] : []
  })
}

/**
 * Tabs through the workbench's load form from its first control and gives each stop until the focus
 * leaves it. The visual blocks: the pinned row, the card columns left to right (one flow where they
 * have no box) and the Run bar; `y` in the form's own coordinates, so a scroll between stops changes
 * nothing.
 */
export async function tabStops(form: Locator) {
  const page = form.page()
  await form.evaluate((f) => f.querySelector<HTMLElement>('input, button, [tabindex="0"]')?.focus())
  const stops: Stop[] = []
  for (let i = 0; i < 150; i++) {
    const stop = await form.evaluate((f): Stop | null => {
      const e = document.activeElement as HTMLElement | null
      if (!e || !f.contains(e)) return null
      const columns = [...f.querySelectorAll<HTMLElement>('.panel-column')]
        .filter((c) => c.checkVisibility())
        .sort((a, b) => {
          const [ra, rb] = [a.getBoundingClientRect(), b.getBoundingClientRect()]
          return ra.left - rb.left || ra.top - rb.top
        })
      // below 75em the columns have no box and the cards are one flow
      const cards = columns.length ? columns : [f.querySelector('.panels')]
      const blocks = [f.querySelector('.pinned-row'), ...cards, f.querySelector('.run-bar')]
      const block = blocks.findIndex((b) => b?.contains(e))
      if (block < 0) throw new Error(`${e.outerHTML.slice(0, 80)} is in no block of the form`)
      const r = e.getBoundingClientRect()
      const box = f.getBoundingClientRect()
      const scroller = f.closest('.workspace-inputs')?.scrollTop ?? 0
      const label =
        e.getAttribute('aria-label') ||
        (e.id && document.querySelector(`label[for="${e.id}"]`)?.textContent) ||
        e.textContent ||
        e.tagName
      return {
        name: label.trim().slice(0, 40),
        key: [block, Math.round(r.top + r.height / 2 - box.top + scroller), Math.round(r.left)],
      }
    })
    if (!stop) return stops
    stops.push(stop)
    await page.keyboard.press('Tab')
  }
  throw new Error('the focus did not leave the form after 150 stops')
}
