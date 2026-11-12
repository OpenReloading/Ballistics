import { useLingui } from '@lingui/react'
import { arraySource, type DataQuery, PageBar } from '@open-reloading/ui'
import { createFileRoute } from '@tanstack/react-router'
import { createColumnHelper } from '@tanstack/react-table'
import { useEffect, useMemo, useState } from 'react'
import { chunkedSource, timedSource } from '../grid/chunked-source.ts'
import { Grid, type gridFeatures } from '../grid/grid.tsx'
import { type GridRow, generateRows, gridColumns } from '../grid/rows.ts'

interface GridSearch {
  source?: 'chunked'
  defer?: true
  overscan?: number
}

// read by e2e/s9.spec.ts: the time to build the rows and of every query's synchronous part
declare global {
  interface Window {
    gridProbe?: { generateMs: number; queries: { ms: number; query: DataQuery }[] }
  }
}

export const Route = createFileRoute('/grid')({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): GridSearch => ({
    ...(search.source === 'chunked' ? { source: 'chunked' } : {}),
    ...(search.defer ? { defer: true } : {}),
    ...(Number(search.overscan) >= 0 && search.overscan !== undefined
      ? { overscan: Number(search.overscan) }
      : {}),
  }),
  component: GridPage,
})

const rowCount = 200_000
const helper = createColumnHelper<typeof gridFeatures, GridRow>()
const numeric = new Set(['diameter', 'weight', 'bc', 'length'])

function GridPage() {
  const { i18n } = useLingui()
  const { source: kind, defer, overscan } = Route.useSearch()
  const [rows, setRows] = useState<GridRow[]>()

  // ?defer waits for the test's `grid:start` event, so the heap can be read before the rows exist
  useEffect(() => {
    const build = () => {
      const t = performance.now()
      const built = generateRows(rowCount)
      window.gridProbe = { generateMs: performance.now() - t, queries: [] }
      setRows(built)
    }
    if (!defer) {
      build()
      return
    }
    window.addEventListener('grid:start', build, { once: true })
    return () => window.removeEventListener('grid:start', build)
  }, [defer])

  const source = useMemo(() => {
    if (!rows || !window.gridProbe) return
    const inner = timedSource(arraySource(rows, gridColumns), window.gridProbe.queries)
    return kind === 'chunked' ? chunkedSource(inner) : inner
  }, [rows, kind])

  const columns = useMemo(
    () =>
      helper.columns([
        helper.accessor('name', { header: i18n._({ id: 'grid.name', message: 'Name' }) }),
        helper.accessor('maker', { header: i18n._({ id: 'grid.maker', message: 'Maker' }) }),
        helper.accessor('diameter', {
          header: i18n._({ id: 'grid.diameter', message: 'Diameter (mm)' }),
        }),
        helper.accessor('weight', {
          header: i18n._({ id: 'grid.weight', message: 'Weight (gr)' }),
        }),
        helper.accessor('bc', { header: i18n._({ id: 'grid.bc', message: 'BC (G1)' }) }),
        helper.accessor('length', {
          header: i18n._({ id: 'grid.length', message: 'Length (mm)' }),
        }),
        helper.accessor('kind', { header: i18n._({ id: 'grid.kind', message: 'Type' }) }),
        helper.accessor('released', {
          header: i18n._({ id: 'grid.released', message: 'Released' }),
        }),
      ]),
    [i18n],
  )

  return (
    <>
      <PageBar title={i18n._({ id: 'grid.title', message: 'Bullets' })} />
      {source && (
        <Grid
          source={source}
          columns={columns}
          label={i18n._({ id: 'grid.title', message: 'Bullets' })}
          filterColumn="name"
          filterLabel={i18n._({ id: 'grid.filter', message: 'Filter by name' })}
          numeric={numeric}
          overscan={overscan}
        />
      )}
    </>
  )
}
