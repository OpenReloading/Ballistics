import dynamic from '@/platform/dynamic.tsx'

/** `VivacityChart` loaded apart from the page, so the record pages do not download the chart library up front. */
export const LazyVivacityChart = dynamic(
  () => import('./vivacity-chart.tsx').then((m) => m.VivacityChart),
  { loading: () => <div className="chart vivacity-loading" /> },
)
