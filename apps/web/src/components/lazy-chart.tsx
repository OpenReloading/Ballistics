'use client'

import dynamic from 'next/dynamic'

const load = () => import('./line-chart.tsx').then((m) => m.LineChart)
const loadInterior = () => import('./interior-chart.tsx').then((m) => m.InteriorChart)

/** Loaded apart, so pages that only prefetch the calculator routes skip the chart library; preloaded on mount or when idle, so a result never waits and a later chunk outage does not hide the chart. */
export const LazyLineChart = dynamic(load, { ssr: false })
export const LazyInteriorChart = dynamic(loadInterior, { ssr: false })

export function preloadChart() {
  load().catch(() => {})
}

export function preloadInteriorChart() {
  loadInterior().catch(() => {})
}
