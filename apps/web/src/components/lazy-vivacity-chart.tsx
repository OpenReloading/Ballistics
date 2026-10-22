'use client'

import dynamic from 'next/dynamic'

/** `VivacityChart` loaded apart from the page, so the record pages do not download the chart library up front. */
export const LazyVivacityChart = dynamic(
  () => import('./vivacity-chart.tsx').then((m) => m.VivacityChart),
  { ssr: false, loading: () => <div className="chart vivacity-loading" /> },
)
