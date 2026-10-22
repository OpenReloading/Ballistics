'use client'

import dynamic from 'next/dynamic'

const load = () => import('./line-chart.tsx').then((m) => m.LineChart)
const loadInterior = () => import('./interior-chart.tsx').then((m) => m.InteriorChart)

/**
 * `LineChart` and the workbench's `InteriorChart` loaded apart from the page, so pages that only
 * prefetch the calculator routes do not download the chart library. The Trajectory form calls
 * `preloadChart` on mount, the workbench `preloadInteriorChart` once its cards show and the page is
 * idle: a result never waits for the code, and a chunk outage after the page loaded does not
 * hide the chart.
 */
export const LazyLineChart = dynamic(load, { ssr: false })
export const LazyInteriorChart = dynamic(loadInterior, { ssr: false })

export function preloadChart() {
  load().catch(() => {})
}

export function preloadInteriorChart() {
  loadInterior().catch(() => {})
}
