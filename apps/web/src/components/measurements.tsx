'use client'

import { Button } from '@mantine/core'
import type { VelocityUnit } from '@open-reloading/importers'
import { chronoSession, type SessionRecord, toSi } from '@open-reloading/schema'
import { type Dispatch, type ReactNode, type SetStateAction, useRef, useState } from 'react'
import { chronoFileBytes, readChrono } from '../lib/chrono.ts'
import { errorText } from '../lib/error-text.ts'
import {
  type ChargeRow,
  chargeRows,
  type SimulatedStep,
  sessionOf,
  simulatedCurve,
  stringCharge,
  withCharge,
} from '../lib/measurements.ts'
import { newId } from '../lib/new-id.ts'
import { nth } from '../lib/nth.ts'
import { controlSize } from '../lib/theme.ts'
import { formatNumber, type UnitSystem, withUnit } from '../lib/units.ts'
import { ChronoFileInput } from './chrono-file-input.tsx'
import { LadderFlatSpots } from './ladder-flat-spots.tsx'
import { LineChart, useChartScale } from './line-chart.tsx'
import { PanelTable } from './scroll-region.tsx'
import { ErrorNote } from './states.tsx'
import { useResult } from './workbench-context.ts'

/** A step of the last run as the Measurements tab needs it. */
/** `label`: the step relative to the main charge. */
type MeasuredStep = SimulatedStep & { n: number; label?: string | undefined }

const columns = [
  'Series',
  'Charge',
  'Shots',
  'Excluded',
  'Mean',
  'SD',
  'ES',
  'Simulated',
  'Difference',
  'Difference %',
] as const
/** Sessions a load names at most (`Load.sessions`). */
const maxSessions = 50
const tableName = 'Measured against simulated velocity per charge'
const chartName = 'Measured mean velocity and simulated muzzle velocity against charge'

/** Marker shapes per series, so series differ by more than colour. */
const shapes = ['circle', 'square', 'triangle', 'diamond'] as const
type Shape = (typeof shapes)[number]

function Marker({
  shape,
  x,
  y,
  r = 5,
}: {
  shape: Shape
  x: number
  y: number
  r?: number | undefined
}) {
  if (shape === 'circle') return <circle cx={x} cy={y} r={r} />
  if (shape === 'square') return <rect x={x - r} y={y - r} width={2 * r} height={2 * r} />
  const points =
    shape === 'triangle'
      ? [x, y - r - 1, x + r + 1, y + r, x - r - 1, y + r]
      : [x, y - r - 1, x + r + 1, y, x, y + r + 1, x - r - 1, y]
  return <polygon points={points.join(' ')} />
}

/** Series colour beside the shape: the chart palette after the first colour. */
const colour = (k: number) => `var(--series-${(k % shapes.length) + 2})`

function LegendShape({ shape, k }: { shape: Shape; k: number }) {
  return (
    <svg
      viewBox="0 0 14 14"
      width="14"
      height="14"
      aria-hidden="true"
      focusable="false"
      className="series-shape"
      style={{ color: colour(k) }}
    >
      <Marker shape={shape} x={7} y={7} r={4} />
    </svg>
  )
}

type Plotted = { shape: Shape; rows: ChargeRow[] }

/** Means with one-SD bars and excluded shots as crosses, drawn on the chart's scales in display units. */
function Marks({ series, system }: { series: Plotted[]; system: UnitSystem }) {
  const sc = useChartScale()
  const xs = sc?.x
  const ys = sc?.y
  if (!xs || !ys) return null
  const px = (kg: number) => xs(system.charge.fromSi(kg)) ?? Number.NaN
  const py = (ms: number) => ys(system.velocity.fromSi(ms)) ?? Number.NaN
  return (
    <g className="measured-marks">
      {series.map(({ shape, rows }, k) =>
        rows.map((r) => {
          const x = px(r.charge)
          const st = r.velocityStats
          return (
            // biome-ignore lint/suspicious/noArrayIndexKey: series keep their order of reading
            <g key={`${k} ${r.charge}`} data-shape={shape} style={{ color: colour(k) }}>
              {st?.standardDeviation !== undefined && (
                <g className="error-bar">
                  <line
                    x1={x}
                    x2={x}
                    y1={py(st.mean - st.standardDeviation)}
                    y2={py(st.mean + st.standardDeviation)}
                  />
                  <line
                    x1={x - 4}
                    x2={x + 4}
                    y1={py(st.mean - st.standardDeviation)}
                    y2={py(st.mean - st.standardDeviation)}
                  />
                  <line
                    x1={x - 4}
                    x2={x + 4}
                    y1={py(st.mean + st.standardDeviation)}
                    y2={py(st.mean + st.standardDeviation)}
                  />
                </g>
              )}
              {st && <Marker shape={shape} x={x} y={py(st.mean)} />}
              {r.excludedShots.map((e, i) => {
                const y = py(e.velocity)
                return (
                  // biome-ignore lint/suspicious/noArrayIndexKey: shots keep the file order
                  <path key={i} className="excluded-mark" d={`M${x - 4} ${y - 4}l8 8m0 -8l-8 8`} />
                )
              })}
            </g>
          )
        }),
      )}
    </g>
  )
}

/** Reads one chronograph file as a session record; a maker named by several files is one reference. */
async function readSession(
  file: File,
  unit: VelocityUnit | '',
  steps: MeasuredStep[] | undefined,
  makers: Map<string, string | undefined>,
  manufacturerRef: (name: string) => string | undefined,
) {
  // taken before the first await, so reads that overlap never share an id
  const id = newId()
  const data = await readChrono(await chronoFileBytes(file), {
    fileName: file.name,
    ...(unit ? { velocityUnit: unit } : {}),
  })
  // string k takes step k's charge; the selects show the guess
  const charges = data.session.strings.map((_, i) => steps?.[i]?.charge)
  // checked before the maker is stored: a file over the schema's caps would be stored as an
  // invalid record
  const now = new Date()
  const draft = sessionOf(file.name, data, charges, { id, now })
  const checked = chronoSession.safeParse(draft.data)
  if (!checked.success)
    throw new Error(checked.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '))
  const named = data.session.device.manufacturerName?.trim() ?? ''
  if (named && !makers.has(named)) makers.set(named, manufacturerRef(named))
  return sessionOf(file.name, data, charges, { id, manufacturer: makers.get(named), now })
}

/** `text` of a statistic when there is one, else nothing. */
const when = <T,>(x: T | undefined, text: (x: T) => string) => (x === undefined ? '' : text(x))

function SeriesRow({
  name,
  shape,
  k,
  row: r,
  charge,
  speed,
}: {
  name: string
  shape: Shape
  k: number
  row: ChargeRow
  charge: (kg: number) => string
  speed: (ms: number) => string
}) {
  const stats = r.velocityStats
  return (
    <tr>
      <td data-label={columns[0]}>
        <span className="series-name">
          <LegendShape shape={shape} k={k} />
          {name}
        </span>
      </td>
      <td data-label={columns[1]} className="num">
        {charge(r.charge)}
      </td>
      <td data-label={columns[2]} className="num">
        {stats?.count ?? 0}
      </td>
      <td data-label={columns[3]} className="num">
        {r.excludedShots.length}
      </td>
      <td data-label={columns[4]} className="num">
        {when(stats, (st) => speed(st.mean))}
      </td>
      <td data-label={columns[5]} className="num">
        {when(stats?.standardDeviation, speed)}
      </td>
      <td data-label={columns[6]} className="num">
        {when(stats, (st) => speed(st.extremeSpread))}
      </td>
      <td data-label={columns[7]} className="num">
        {when(r.simulatedVelocity, speed) || 'no step'}
      </td>
      <td data-label={columns[8]} className="num">
        {when(r.velocityDifference, speed)}
      </td>
      <td data-label={columns[9]} className="num">
        {when(r.differencePercent, (x) => `${formatNumber(x, 1)} %`)}
      </td>
    </tr>
  )
}

/**
 * The Measurements tab: chronograph files read in the browser, strings mapped to the charges of the
 * last run, a table per series and charge and one chart over charge. `steps` is undefined before a
 * run. The sessions are user records the load references, stored as they change.
 */
export function Measurements({
  steps,
  system,
  sessions,
  setSessions,
  idPrefix = 'measurements',
}: {
  /** Ids of the controls; the phone range view shows a second copy. */
  idPrefix?: string | undefined
  steps: MeasuredStep[] | undefined
  system: UnitSystem
  sessions: SessionRecord[]
  setSessions: Dispatch<SetStateAction<SessionRecord[]>>
}) {
  const { manufacturerRef, manufacturerName, sessionRefCount } = useResult()
  const [unit, setUnit] = useState<VelocityUnit | ''>('')
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const reserved = useRef(0)

  async function readFiles(files: File[]) {
    setError('')
    setStatus('')
    const read: SessionRecord[] = []
    const failed: string[] = []
    // a maker named by several files is one reference, a new one is stored once
    const makers = new Map<string, string | undefined>()
    // a load names up to maxSessions sessions; the slots of reads still running are taken
    const room = Math.max(0, maxSessions - sessionRefCount - reserved.current)
    const taken = files.slice(0, room)
    reserved.current += taken.length
    for (const file of files.slice(room))
      failed.push(`${file.name}: a load keeps ${maxSessions} sessions at most.`)
    for (const file of taken) {
      try {
        read.push(await readSession(file, unit, steps, makers, manufacturerRef))
      } catch (err) {
        failed.push(`${file.name}: ${errorText(err)}`)
      }
    }
    setSessions((s) => [...s, ...read])
    reserved.current -= taken.length
    if (read.length > 0)
      setStatus(
        `Read ${read.map((r) => `${r.name}, ${r.data.strings.length} strings`).join('; ')}.`,
      )
    if (failed.length > 0) setError(failed.join(' '))
  }

  const charge = (kg: number) => withUnit('charge', system, kg)
  const v = system.velocity
  const speed = (ms: number) => formatNumber(v.fromSi(ms), 1)
  const runSteps = steps ?? []
  const curve = simulatedCurve(runSteps)
  const plotted = sessions.map((s, k) => ({
    s,
    shape: nth(shapes, k % shapes.length),
    rows: chargeRows(
      s.data.strings.map((str) => ({ charge: stringCharge(str), shots: str.shots })),
      runSteps,
    ),
  }))
  const device = (s: SessionRecord) =>
    [manufacturerName(s.data.device.manufacturer), s.data.device.model].filter(Boolean).join(' ')
  const seriesName = (s: SessionRecord) =>
    [s.name, s.data.date, device(s)].filter(Boolean).join(', ')
  const distances = sessions.flatMap((s) => {
    const d = s.data.muzzleDistance
    return d !== undefined
      ? [`${withUnit('length', system, toSi('length', d.value))} (${s.name})`]
      : []
  })

  function mapString(id: string, i: number, value: string) {
    setSessions((all) =>
      all.map((s) => {
        if (s.id !== id) return s
        const strings = [...s.data.strings]
        const current = strings[i]
        if (current) strings[i] = withCharge(current, value === '' ? undefined : Number(value))
        return { ...s, data: { ...s.data, strings } }
      }),
    )
  }

  let table: ReactNode = null
  if (plotted.some((p) => p.rows.length > 0))
    table = (
      <PanelTable
        label="Measured against simulated velocity"
        className="limits"
        caption={
          <>
            {tableName} ({v.symbol})
          </>
        }
        columns={columns}
      >
        {plotted.flatMap(({ s, shape, rows }, k) =>
          rows.map((r) => (
            <SeriesRow
              key={`${s.id} ${r.charge}`}
              name={s.name}
              shape={shape}
              k={k}
              row={r}
              charge={charge}
              speed={speed}
            />
          )),
        )}
      </PanelTable>
    )

  const excluded = plotted.flatMap(({ s, rows }) =>
    rows.flatMap((r) =>
      r.excludedShots.map(
        (e) => `${s.name}, ${charge(r.charge)}: ${speed(e.velocity)} ${v.symbol}, ${e.reason}`,
      ),
    ),
  )
  const drawn = plotted.map((p) => ({
    ...p,
    rows: p.rows.filter((r) => r.simulatedVelocity !== undefined),
  }))
  const marks = drawn.flatMap((p) =>
    p.rows.flatMap((r) => [
      ...(r.velocityStats
        ? [
            r.velocityStats.mean - (r.velocityStats.standardDeviation ?? 0),
            r.velocityStats.mean + (r.velocityStats.standardDeviation ?? 0),
          ]
        : []),
      ...r.excludedShots.map((e) => e.velocity),
    ]),
  )

  return (
    <div className="measurements">
      <p className="note">
        Sessions are kept in this browser and the saved load names them; a load file or copied link
        does not carry their shots. Chronograph velocities are not corrected to the muzzle
        {distances.length > 0 ? `; measured at ${distances.join(', ')} from the muzzle` : ''}.
      </p>
      <ChronoFileInput
        id={`${idPrefix}-file`}
        unitId={`${idPrefix}-unit`}
        label="Chronograph files, one series each"
        multiple
        unit={unit}
        onUnit={setUnit}
        onFiles={readFiles}
      />
      <p role="status">{status}</p>
      {error && <ErrorNote title="The file was not read.">{error}</ErrorNote>}
      {sessions.length === 0 && (
        <p className="prompt empty-state">
          Read a chronograph file to compare its strings with the simulated velocity per charge.
          Nothing is sent; the file is read in this browser.
        </p>
      )}
      {sessions.length > 0 && !steps && (
        <p className="prompt empty-state">
          Run the simulation, with a charge ladder for several charges, to map the strings to
          charges.
        </p>
      )}
      {table}
      {table &&
        (curve.length < 2 ? (
          <p className="note">The chart needs a charge ladder of two steps or more.</p>
        ) : (
          <figure className="measurements-chart">
            <LineChart
              x={curve.map((s) => system.charge.fromSi(s.charge))}
              y={curve.map((s) => v.fromSi(s.muzzleVelocity ?? 0))}
              xLabel={`Charge (${system.charge.symbol})`}
              yLabel={`Velocity (${v.symbol})`}
              title={chartName}
              description={`The line is the simulated muzzle velocity of the ladder steps; each series' measured mean is a marker with a bar of one standard deviation, excluded shots are crosses. The table "${tableName}" gives the values.`}
              include={marks.map((ms) => v.fromSi(ms))}
            >
              <Marks series={drawn} system={system} />
            </LineChart>
            <ul className="chart-legend" aria-label="Chart legend">
              <li>
                <span className="legend-line" aria-hidden="true" /> Simulated muzzle velocity
              </li>
              {drawn.map(({ s, shape }, k) => (
                <li key={s.id}>
                  <LegendShape shape={shape} k={k} /> {s.name}: measured mean, bar one SD
                </li>
              ))}
              {excluded.length > 0 && (
                <li>
                  <svg viewBox="0 0 14 14" width="14" height="14" aria-hidden="true">
                    <path className="excluded-mark" d="M3 3l8 8m0 -8l-8 8" />
                  </svg>{' '}
                  Excluded shot
                </li>
              )}
            </ul>
          </figure>
        ))}
      <LadderFlatSpots
        series={plotted.map(({ s, rows }) => ({ id: s.id, name: s.name, rows }))}
        system={system}
      />
      {excluded.length > 0 && (
        <>
          <h3>Excluded shots</h3>
          <ul>
            {excluded.map((t, k) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: shots keep the file order and may repeat
              <li key={k}>{t}</li>
            ))}
          </ul>
        </>
      )}
      {sessions.length > 0 && <h3>Strings and charges</h3>}
      {plotted.map(({ s, shape }, k) => (
        <fieldset key={s.id} className="measured-series">
          <legend className="series-name">
            <LegendShape shape={shape} k={k} /> {seriesName(s)}
          </legend>
          {s.data.strings.map((str, i) => {
            const label = str.label
            const name = `String ${i + 1}${label ? `: ${label}` : ''}`
            const at = stringCharge(str)
            const step =
              at === undefined ? undefined : runSteps.find((st) => Math.abs(st.charge - at) < 1e-7)
            return (
              // biome-ignore lint/suspicious/noArrayIndexKey: strings keep the file order and have no id
              <div key={i} className="field">
                <label htmlFor={`${idPrefix}-series-${s.id}-${i}`}>
                  {name} ({str.shots.length} shots)
                </label>
                <select
                  id={`${idPrefix}-series-${s.id}-${i}`}
                  value={at === undefined ? '' : String(step?.charge ?? at)}
                  disabled={!steps}
                  onChange={(e) => mapString(s.id, i, e.target.value)}
                >
                  <option value="">Not used</option>
                  {runSteps.map((st) => (
                    <option key={st.n} value={String(st.charge)}>
                      Step {st.label ?? st.n}, {charge(st.charge)}
                    </option>
                  ))}
                  {at !== undefined && !step && (
                    <option value={String(at)}>{charge(at)} (not in this run)</option>
                  )}
                </select>
              </div>
            )
          })}
          <Button
            variant="subtle"
            size={controlSize.row.button}
            onClick={() => setSessions((all) => all.filter((x) => x.id !== s.id))}
          >
            Remove {s.name}
          </Button>
        </fieldset>
      ))}
    </div>
  )
}
