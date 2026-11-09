'use client'

import { useFocusTrap, useMediaQuery, useMergedRef } from '@mantine/hooks'
import { chargeLadder } from '@open-reloading/ballistics'
import { type ComponentProps, useEffect, useState } from 'react'
import { useTranslation } from '../i18n/language.ts'
import type { LadderDirection } from '../lib/seating-ladder.ts'
import { stepLabel } from '../lib/workbench.ts'
import { TargetEditor } from './target-editor.tsx'
import { useDropSlope } from './use-drop-slope.ts'

/** From 62em as tall as the results column leaves room for, so the column does not scroll; Expand shows the same editor as a dialog, not mounted again, and Esc or Close returns the focus to Expand. */
export function GroupsTab({
  ladder,
  trajectoryLoad,
  ...props
}: Omit<ComponentProps<typeof TargetEditor>, 'charges' | 'stepLabels' | 'slopeAt'> & {
  /** The load the Trajectory tab starts from: the drop slope of the point of impact per charge. */
  trajectoryLoad: Parameters<typeof useDropSlope>[0]
  /** The load's charge ladder, as the API runs it; its charges label the ladder steps. */
  ladder?: { charge: number; step: number; steps: number; direction: LadderDirection } | undefined
}) {
  const { t } = useTranslation()
  let charges: number[] | undefined
  try {
    charges = ladder && chargeLadder(ladder.charge, ladder.step, ladder.steps, ladder.direction)
  } catch {}
  const slopeAt = useDropSlope(trajectoryLoad)
  const framed = useMediaQuery('screen and (min-width: 62em)')
  const [box, setBox] = useState<HTMLDivElement | null>(null)
  const [height, setHeight] = useState<number>()
  const [expanded, setExpanded] = useState(false)
  const trap = useFocusTrap(expanded)
  const ref = useMergedRef<HTMLDivElement>((n: HTMLDivElement | null) => setBox(n), trap)
  const close = () => {
    setExpanded(false)
    requestAnimationFrame(() => box?.querySelector<HTMLElement>('[data-expand]')?.focus())
  }
  useEffect(() => {
    // expanded, the box is the window: the height for the column waits
    if (expanded) return
    if (!framed || !box) return setHeight(undefined)
    let column: HTMLElement | null = box.parentElement
    while (column && !/auto|scroll/.test(getComputedStyle(column).overflowY))
      column = column.parentElement
    if (!column) return
    const scroller = column
    const fit = () => {
      // a hidden tab panel measures as zero: keep the height until it shows again
      if (box.getClientRects().length === 0) return
      // shrink by what the column overflows, else grow to 8 px above its bottom
      const over = scroller.scrollHeight - scroller.clientHeight
      const gap = scroller.getBoundingClientRect().bottom - box.getBoundingClientRect().bottom - 8
      const delta = over > 0 ? -over : gap
      if (Math.abs(delta) < 2) return
      setHeight((h) => Math.max(240, Math.round((h ?? box.getBoundingClientRect().height) + delta)))
    }
    const seen = new ResizeObserver(fit)
    seen.observe(scroller)
    seen.observe(box)
    return () => seen.disconnect()
  }, [framed, box, expanded])
  if (props.load === undefined)
    return (
      <p className="prompt empty-state">
        {t('Save the load (Save in the page bar) to attach target sheets and shot groups.')}
      </p>
    )
  return (
    <div
      ref={ref}
      className="groups-tab"
      data-expanded={expanded || undefined}
      role="presentation"
      {...(expanded && { role: 'dialog', 'aria-modal': true, 'aria-label': t('Shot groups') })}
      style={height && !expanded ? { height } : undefined}
      onKeyDown={(e) => {
        // not when the editor used the key, nor from a popover outside the box
        if (
          expanded &&
          e.key === 'Escape' &&
          !e.defaultPrevented &&
          e.currentTarget.contains(e.target as Node)
        )
          close()
      }}
    >
      <TargetEditor
        {...props}
        charges={charges}
        slopeAt={slopeAt}
        stepLabels={charges?.map((_, i) => stepLabel(i, charges.length, ladder?.direction ?? 'up'))}
        expand={{ expanded, onChange: (on) => (on ? setExpanded(true) : close()) }}
      />
    </div>
  )
}
