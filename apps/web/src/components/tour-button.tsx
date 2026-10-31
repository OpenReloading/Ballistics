'use client'

import { Button, Indicator } from '@mantine/core'
import { Signpost } from '@phosphor-icons/react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from '../i18n/language.ts'
import { markTourSeen, type TourPage, tourSeen, tours } from '../lib/tours.ts'
import { focusBack } from './focus-back.ts'

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
      onPopoverRender: (p) => p.wrapper.setAttribute('aria-modal', 'true'),
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
