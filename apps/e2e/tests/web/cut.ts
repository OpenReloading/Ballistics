import type { Page } from '@playwright/test'

const controls = 'main :is(button, [role=tab], input, label, dt, dd, .field-unit)'

/**
 * Buttons, tabs, fields, labels, units and values whose text overflows their own box or whose box is
 * cut by an ancestor that clips; what a scroll container holds counts as scrolled, not cut.
 */
export const cut = (page: Page) => cutIn(page, { strict: false, exempt: '', controls })

/**
 * Every field and every element of `main` with text of its own that overflows its box sideways or
 * downwards or is cut by an ancestor, except inside what `exempt` matches.
 */
export const cutText = (page: Page, exempt: string) =>
  cutIn(page, { strict: true, exempt, controls })

const cutIn = (page: Page, options: { strict: boolean; exempt: string; controls: string }) =>
  page.evaluate(({ strict, exempt, controls }) => {
    const clips = (o: string) => o === 'hidden' || o === 'clip'
    const hidden = (e: Element) => {
      for (let a: Element | null = e; a; a = a.parentElement)
        if (getComputedStyle(a).clipPath === 'inset(50%)') return true
      return false
    }
    // whether the box `r` lies outside the area `a` clips
    const outside = (a: Element, as: CSSStyleDeclaration, r: DOMRect) => {
      const b = a.getBoundingClientRect()
      const [left, top] = [b.left + a.clientLeft, b.top + a.clientTop]
      const x = clips(as.overflowX) && (r.left < left - 1 || r.right > left + a.clientWidth + 1)
      const y = clips(as.overflowY) && (r.top < top - 1 || r.bottom > top + a.clientHeight + 1)
      return x || y
    }
    // the ancestor that clips the box `r` of `e`, up to the first scroll container
    const cutBy = (e: HTMLElement, r: DOMRect): string | undefined => {
      for (let a = e.parentElement; a; a = a.parentElement) {
        const as = getComputedStyle(a)
        if ([as.overflowX, as.overflowY].some((o) => o === 'auto' || o === 'scroll')) return
        if (outside(a, as, r)) return `${a.tagName}.${a.className}`
      }
    }
    // how the text of `e` overflows its own box, if it does
    const overflows = (e: HTMLElement) => {
      const s = getComputedStyle(e)
      if ((e.tagName === 'INPUT' || clips(s.overflowX)) && e.scrollWidth > e.clientWidth + 1)
        return 'overflows'
      if (strict && clips(s.overflowY) && e.scrollHeight > e.clientHeight + 1)
        return 'overflows downwards'
    }
    const problems = (e: HTMLElement): string[] => {
      if (strict && exempt && e.closest(exempt)) return []
      const r = e.getBoundingClientRect()
      if (r.width < 2 || r.height < 2 || !e.checkVisibility() || hidden(e)) return []
      const name = `${e.tagName} "${e.textContent || (e as HTMLInputElement).value || e.ariaLabel}"`
      const out: string[] = []
      const how = overflows(e)
      if (how) out.push(`${name} ${how}`)
      const by = cutBy(e, r)
      if (by) out.push(`${name} cut by ${by}`)
      return out
    }
    const ownText = (e: Element) =>
      [...e.childNodes].some((n) => n.nodeType === Node.TEXT_NODE && n.textContent?.trim())
    const all = [...document.querySelectorAll<HTMLElement>(strict ? 'main *' : controls)]
    return (strict ? all.filter((e) => e.tagName === 'INPUT' || ownText(e)) : all).flatMap(problems)
  }, options)
