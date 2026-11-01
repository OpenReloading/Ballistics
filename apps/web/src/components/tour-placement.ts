/** Space between the fixed top bar and a popover beside its target, px. */
const barGap = 8

/**
 * Keeps a popover placed beside its target (driver.js places it after this hook, and again on a
 * scroll or resize) below the fixed top bar: beside a target that starts under the bar it would
 * cover the page actions. A popover above or below its target, beside a target in the bar itself,
 * is left; it moves no further than the window's foot.
 */
export function keepBelowTopBar(wrapper: HTMLElement) {
  const place = () => {
    if (!/driver-popover-side-(left|right)/.test(wrapper.className)) return
    const bar = document.querySelector('.mantine-AppShell-header')?.getBoundingClientRect().bottom
    // below 75em the top bar scrolls away with the page: its foot is then above the window
    if (!bar || bar <= 0) return
    const below = Math.ceil(bar) + barGap
    const target = document.querySelector('.driver-active-element')?.getBoundingClientRect()
    if (!target || target.bottom <= below) return
    const top = Number.parseFloat(wrapper.style.top)
    const lowest = window.innerHeight - wrapper.offsetHeight - barGap
    const next = Math.min(below, lowest)
    // a whole pixel up or down: the written top reads back the same, so no further change follows
    if (Number.isNaN(top) || top >= next - 0.5) return
    wrapper.style.top = `${next}px`
  }
  new MutationObserver(place).observe(wrapper, {
    attributes: true,
    attributeFilter: ['style', 'class'],
  })
}
