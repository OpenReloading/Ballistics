'use client'

import { Button, Indicator } from '@mantine/core'
import { Signpost } from '@phosphor-icons/react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from '../i18n/language.ts'
import { markTourSeen, type TourPage, tourSeen, tours } from '../lib/tours.ts'
import { focusBack } from './focus-back.ts'

/** Space between the fixed top bar and a popover beside its target, px. */
const barGap = 8

/**
 * Keeps a popover placed beside its target (driver.js places it after this hook, and again on a
 * scroll or resize) below the fixed top bar: beside a target that starts under the bar it would
 * cover the page actions. A popover above or below its target, beside a target in the bar itself,
 * is left; it moves no further than the window's foot.
 */
function keepBelowTopBar(wrapper: HTMLElement) {
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

/** Starts the short tour of `page`; a dot marks it until the viewer has opened it once. */
export function TourButton({ page }: { page: TourPage }) {
  const { t } = useTranslation()
  const button = useRef<HTMLButtonElement>(null)
  // read after mount: the static page has no storage
  const [seen, setSeen] = useState(true)
  useEffect(() => setSeen(tourSeen(page)), [page])

  async function start() {
    // a plain import() on first use keeps the library out of the route's initial weight
    const [{ driver }] = await Promise.all([
      import('driver.js'),
      import('driver.js/dist/driver.css'),
    ])
    // a step whose element is not shown (another layout, a closed tab) is left out
    const steps = tours[page].flatMap((s) => {
      const element = [...document.querySelectorAll(s.target)].find(
        (e) => e.getClientRects().length > 0,
      )
      return element ? [{ element, popover: { title: t(s.title), description: t(s.text) } }] : []
    })
    if (steps.length === 0) return
    markTourSeen(page)
    setSeen(true)
    driver({
      steps,
      popoverClass: 'tour-popover',
      showProgress: true,
      progressText: t('Step {current} of {total}', {
        current: '{{current}}',
        total: '{{total}}',
      }),
      nextBtnText: t('Next'),
      prevBtnText: t('Back'),
      doneBtnText: t('Done'),
      closeBtnLabel: t('Close the tour'),
      onPopoverRender: (p) => {
        keepBelowTopBar(p.wrapper)
        p.wrapper.setAttribute('aria-modal', 'true')
        // the glyph is not the button's name: only the label is read
        const glyph = document.createElement('span')
        glyph.setAttribute('aria-hidden', 'true')
        glyph.textContent = p.closeButton.textContent
        p.closeButton.replaceChildren(glyph)
      },
      // below 75em the button sat in the closed Page actions panel: its toggle takes focus
      onDestroyed: () => focusBack(button.current, '.page-bar .page-bar-toggle'),
    }).drive()
  }

  return (
    <Indicator disabled={seen} size={8} offset={4}>
      <Button
        ref={button}
        variant="default"
        className="bar-icon"
        leftSection={<Signpost size={18} aria-hidden="true" />}
        title={t('Tour of this page')}
        onClick={start}
      >
        {t('Tour')}
      </Button>
    </Indicator>
  )
}
