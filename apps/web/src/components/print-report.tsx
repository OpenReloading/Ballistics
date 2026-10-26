'use client'

import { type ReactNode, type Ref, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { usePortalBody } from './print.ts'

/**
 * A copy of a drawn chart's SVG that scales to the paper. Sized from the SVG's own width and height,
 * which a chart in a hidden tab keeps (its box measures 0).
 */
export function chartCopy(svg: SVGSVGElement): SVGSVGElement {
  const clone = svg.cloneNode(true) as SVGSVGElement
  const w = Number(svg.getAttribute('width')) || svg.clientWidth
  const h = Number(svg.getAttribute('height')) || svg.clientHeight
  if (!clone.getAttribute('viewBox') && w && h) clone.setAttribute('viewBox', `0 0 ${w} ${h}`)
  clone.removeAttribute('width')
  clone.removeAttribute('height')
  // ECharts places its SVG absolutely over the chart box; the copy keeps the chart's shape
  clone.removeAttribute('style')
  if (w && h) clone.style.aspectRatio = `${w} / ${h}`
  return clone
}

/**
 * A page's print view: rendered into `body`, never on screen, printed alone
 * while it is mounted and shown (`<html data-report>`) and no other print mode (`<html data-print>`)
 * is set. `chartSlot` receives the chart slot, which the page fills with a `chartCopy` after each draw.
 */
export function PrintReport({
  children,
  after,
  chartSlot,
}: {
  children: ReactNode
  /** What follows the chart. */
  after?: ReactNode | undefined
  chartSlot?: Ref<HTMLDivElement> | undefined
}) {
  const body = usePortalBody()
  // the report prints only while its page is shown: a page kept hidden (Activity) runs this cleanup
  useEffect(() => {
    const html = document.documentElement
    html.dataset.report = ''
    return () => {
      delete html.dataset.report
    }
  }, [])
  if (!body) return null
  return createPortal(
    <div className="print-report">
      {children}
      {chartSlot && <div ref={chartSlot} className="report-chart" />}
      {after}
    </div>,
    body,
  )
}
