'use client'

import {
  Badge,
  Button,
  Checkbox,
  Group,
  Select,
  Slider,
  Table,
  Text,
  TextInput,
} from '@mantine/core'
import type { InteriorLoad, PowderParameter } from '@open-reloading/core'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  bandNote,
  type CurvePoint,
  heldText,
  ladders,
  summary,
  type TuneAnswer,
  type TuneString,
  thin,
  thinText,
} from '../lib/powder-tune-proto.ts'
import type { ProtoMessage } from '../lib/powder-tune-proto.worker.ts'
import { PageBar } from './page-bar.tsx'
import { Message } from './states.tsx'

const names: Record<PowderParameter, { label: string; unit: string; digits: number }> = {
  burnRate: { label: 'Burn coefficient', unit: '1/s', digits: 3 },
  startPressure: { label: 'Start pressure', unit: 'MPa', digits: 1 },
  volumeFactor: { label: 'Chamber volume factor', unit: '', digits: 3 },
  energy: { label: 'Specific energy', unit: 'MJ/kg', digits: 3 },
  temperatureFactor: { label: 'Temperature factor', unit: '', digits: 3 },
}
/** Parameter value as shown (MPa and MJ/kg for the stored Pa and J/kg). */
const shown = (n: PowderParameter, v: number) =>
  (n === 'startPressure' || n === 'energy' ? v / 1e6 : v).toFixed(names[n].digits)

const reasonWords: Record<string, string> = {
  'no-pressure': 'no measured pressure',
  'capacity-estimated': 'case capacity estimated',
  'narrow-ladder': 'narrow ladder',
  'residual-trend': 'residuals show a trend',
  'start-pressure-correlated': 'start pressure tied to the burn coefficient',
  'weak-prior': 'weak prior',
  extrapolated: 'outside the ladder',
}

/** The chart: band, fitted curve, hand-tuned curve and the strings' means with their spread. */
function Chart({
  curve,
  hand,
  strings,
}: {
  curve: CurvePoint[]
  hand: (number | null)[] | undefined
  strings: TuneString[]
}) {
  const W = 520
  const H = 220
  const m = { l: 44, r: 10, t: 8, b: 30 }
  const pts = strings.filter((s) => s.grams < 3.4).map((s) => ({ g: s.grams, ...summary(s) }))
  const xs = curve.length ? curve.map((c) => c.grams) : pts.map((p) => p.g)
  const x0 = Math.min(...xs) - 0.02
  const x1 = Math.max(...xs) + 0.02
  const ys = [
    ...curve.flatMap((c) => [c.lower ?? c.velocity, c.upper ?? c.velocity]),
    ...pts.map((p) => p.mean - 2 * p.sd),
    ...pts.map((p) => p.mean + 2 * p.sd),
  ]
  const y0 = Math.floor((Math.min(...ys) - 10) / 10) * 10
  const y1 = Math.ceil((Math.max(...ys) + 10) / 10) * 10
  const X = (g: number) => m.l + ((g - x0) / (x1 - x0)) * (W - m.l - m.r)
  const Y = (v: number) => H - m.b - ((v - y0) / (y1 - y0)) * (H - m.t - m.b)
  const line = (f: (c: CurvePoint, i: number) => number | null) =>
    curve
      .map((c, i) => {
        const y = f(c, i)
        return y === null ? '' : `${X(c.grams).toFixed(1)},${Y(y).toFixed(1)}`
      })
      .filter(Boolean)
      .join(' ')
  const band = [
    ...curve.map((c) => `${X(c.grams).toFixed(1)},${Y(c.upper ?? c.velocity).toFixed(1)}`),
    ...[...curve]
      .reverse()
      .map((c) => `${X(c.grams).toFixed(1)},${Y(c.lower ?? c.velocity).toFixed(1)}`),
  ].join(' ')
  const yt = Array.from({ length: 5 }, (_, i) => y0 + ((y1 - y0) * i) / 4)
  const xt = Array.from({ length: 5 }, (_, i) => x0 + ((x1 - x0) * i) / 4)
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label="Muzzle velocity against charge: simulated curve with its band, and the measured strings"
      style={{ width: '100%', height: 'auto', maxHeight: '100%' }}
    >
      {yt.map((v) => (
        <g key={v}>
          <line x1={m.l} x2={W - m.r} y1={Y(v)} y2={Y(v)} stroke="currentColor" opacity={0.12} />
          <text x={m.l - 4} y={Y(v) + 4} textAnchor="end" fontSize={11} fill="currentColor">
            {Math.round(v)}
          </text>
        </g>
      ))}
      {xt.map((g) => (
        <text
          key={g}
          x={X(g)}
          y={H - m.b + 14}
          textAnchor="middle"
          fontSize={11}
          fill="currentColor"
        >
          {g.toFixed(2)}
        </text>
      ))}
      <text x={(m.l + W - m.r) / 2} y={H - 3} textAnchor="middle" fontSize={11} fill="currentColor">
        Charge, g
      </text>
      <text
        x={10}
        y={H / 2}
        fontSize={11}
        fill="currentColor"
        transform={`rotate(-90 10 ${H / 2})`}
        textAnchor="middle"
      >
        Velocity, m/s
      </text>
      {curve.length > 0 && (
        <polygon points={band} fill="var(--mantine-color-blue-6)" opacity={0.18} />
      )}
      {curve.length > 0 && (
        <polyline
          points={line((c) => c.velocity)}
          fill="none"
          stroke="var(--mantine-color-blue-6)"
          strokeWidth={2}
        />
      )}
      {hand && (
        <polyline
          points={line((_, i) => hand[i] ?? null)}
          fill="none"
          stroke="var(--mantine-color-orange-6)"
          strokeWidth={2}
          strokeDasharray="5 3"
        />
      )}
      {pts.map((p) => (
        <g key={p.g} stroke="currentColor" fill="currentColor">
          <line x1={X(p.g)} x2={X(p.g)} y1={Y(p.mean - 2 * p.sd)} y2={Y(p.mean + 2 * p.sd)} />
          <circle cx={X(p.g)} cy={Y(p.mean)} r={3.5} />
        </g>
      ))}
    </svg>
  )
}

/** The band at the ends of the drawn range, where charges were not fired: the curve's first and last point. */
function Unfired({ curve, strings }: { curve: CurvePoint[]; strings: TuneString[] }) {
  const grams = strings.filter((s) => s.grams < 3.4).map((s) => s.grams)
  const lo = Math.min(...grams)
  const hi = Math.max(...grams)
  const ends = [curve[0], curve[curve.length - 1]].filter((c): c is CurvePoint => c !== undefined)
  return (
    <>
      {ends.map((c) => (
        <Text size="xs" key={c.grams}>
          Unfired {c.grams.toFixed(2)} g (
          {c.grams < lo ? 'below' : c.grams > hi ? 'above' : 'inside'} the ladder):{' '}
          {c.velocity.toFixed(0)} m/s, 90 % interval {(c.lower ?? c.velocity).toFixed(0)} to{' '}
          {(c.upper ?? c.velocity).toFixed(0)} m/s.
        </Text>
      ))}
    </>
  )
}

/** Sliders of the free parameters, ranges from the fit interval (3 standard uncertainties). */
function HandTuning({
  fit,
  values,
  redraw,
  onMove,
  onReset,
}: {
  fit: NonNullable<TuneAnswer['fit']>
  values: Partial<Record<PowderParameter, number>>
  redraw: number | undefined
  onMove: (name: PowderParameter, v: number) => void
  onReset: () => void
}) {
  const tuned = Object.keys(values).length > 0
  return (
    <fieldset aria-label="Hand tuning" style={{ border: 0, padding: 0, margin: 0 }}>
      <Group gap="xs">
        <Text fw={600} size="sm">
          Hand tuning
        </Text>
        {tuned && <Badge color="orange">Hand-tuned</Badge>}
        {tuned && redraw !== undefined && <Text size="xs">Redraw {redraw.toFixed(0)} ms</Text>}
        {tuned && (
          <Button variant="default" size="compact-xs" onClick={onReset}>
            Back to the fit
          </Button>
        )}
      </Group>
      {fit.parameters.map((p, i) => {
        const sd = p.sigma ?? p.value * 0.1
        const lo = Math.max(p.value - 3 * sd, p.value * 0.2)
        const hi = p.value + 3 * sd
        const v = values[p.name] ?? p.value
        return (
          <div key={p.name}>
            <Text size="sm" id={`slider-${i}`}>
              {names[p.name].label}: {shown(p.name, v)} {names[p.name].unit}
            </Text>
            <Slider
              thumbLabel={names[p.name].label}
              min={lo}
              max={hi}
              step={(hi - lo) / 200}
              value={v}
              label={null}
              onChange={(x) => onMove(p.name, x)}
            />
          </div>
        )
      })}
      {tuned && (
        <Text size="xs">Hand-tuned values are yours, not a fit. Simulation, not load data.</Text>
      )}
    </fieldset>
  )
}

/** A worker message before its id is set. */
type Unsent = ProtoMessage extends infer M ? (M extends unknown ? Omit<M, 'id'> : never) : never

/** The prototype's worker: replies of the fit and of the hand-tuned curve, with the redraw time after the paint. */
function useTuneWorker(
  onAnswer: (a: TuneAnswer) => void,
  onHand: (v: (number | null)[]) => void,
  onRedraw: (ms: number) => void,
) {
  const worker = useRef<Worker | undefined>(undefined)
  const sent = useRef(0)
  const started = useRef(0)
  useEffect(() => {
    const w = new Worker(new URL('../lib/powder-tune-proto.worker.ts', import.meta.url), {
      type: 'module',
    })
    worker.current = w
    w.onmessage = (e) => {
      const m = e.data
      if (m.kind === 'tune') return onAnswer(m.answer)
      if (m.kind !== 'hand' || m.id !== sent.current) return
      onHand(m.velocities)
      requestAnimationFrame(() => {
        const ms = performance.now() - started.current
        onRedraw(ms)
        const w = window as unknown as { __redrawMs?: number[] }
        w.__redrawMs = [...(w.__redrawMs ?? []), ms]
      })
    }
    return () => w.terminate()
  }, [onAnswer, onHand, onRedraw])
  return useCallback((m: Unsent) => {
    sent.current += 1
    started.current = performance.now()
    worker.current?.postMessage({ ...m, id: sent.current })
  }, [])
}

export function PowderTuneProto() {
  const [ladderId, setLadderId] = useState('good')
  const [added, setAdded] = useState<TuneString[]>([])
  const [answer, setAnswer] = useState<TuneAnswer>()
  const [values, setValues] = useState<Partial<Record<PowderParameter, number>>>({})
  const [hand, setHand] = useState<(number | null)[]>()
  const [redraw, setRedraw] = useState<number>()
  const [form, setForm] = useState({ grams: '', shots: '' })
  const [override, setOverride] = useState<boolean | undefined>(undefined)
  const ladder = ladders.find((l) => l.id === ladderId) ?? ladders[0]
  const strings = useMemo(() => [...(ladder?.strings ?? []), ...added], [ladder, added])

  const post = useTuneWorker(setAnswer, setHand, setRedraw)

  useEffect(() => {
    setValues({})
    setHand(undefined)
    post({
      kind: 'tune',
      request: { ladderId, strings, ...(override === undefined ? {} : { override }) },
    })
  }, [ladderId, strings, override, post])

  const fit = answer?.fit
  const grid = answer?.curve.map((c) => c.grams) ?? []
  const move = (name: PowderParameter, v: number) => {
    if (!fit) return
    const next = { ...values, [name]: v }
    setValues(next)
    post({ kind: 'hand', load: fit.load as InteriorLoad, values: next, grams: grid })
  }
  const tuned = Object.keys(values).length > 0

  const add = () => {
    const shots = form.shots
      .split(/[\s,;]+/)
      .map(Number)
      .filter((n) => Number.isFinite(n) && n > 0)
    const grams = Number(form.grams.replace(',', '.'))
    if (shots.length === 0 || !(grams > 0)) return
    setAdded([...added, { grams, shots }])
    setForm({ grams: '', shots: '' })
  }
  const warnThin = answer?.thin ?? thin(strings)

  return (
    <>
      <PageBar
        title="Tune a powder"
        status="Prototype on synthetic ladders. Simulation, not load data."
      />
      <div className="tune-proto" data-answered={answer?.ladderId}>
        <section aria-label="Strings and fit">
          <Select
            label="Ladder (synthetic)"
            data={ladders.map((l) => ({ value: l.id, label: l.title }))}
            value={ladderId}
            allowDeselect={false}
            onChange={(v) => {
              if (v) {
                setAdded([])
                setOverride(undefined)
                setLadderId(v)
              }
            }}
            description={ladder?.note}
          />
          {warnThin && (
            <Message severity="warning" compact>
              {thinText}
              <Checkbox
                mt={4}
                label="Try the other values anyway"
                checked={override ?? ladder?.override ?? false}
                onChange={(e) => setOverride(e.currentTarget.checked)}
              />
            </Message>
          )}
          {answer?.held && (
            <Message severity="warning" compact>
              {heldText}
            </Message>
          )}
          {answer?.refusal && (
            <Message severity="error" compact>
              {answer.refusal.text}
              {answer.refusal.grams !== undefined && ` (String at ${answer.refusal.grams} g.)`}
            </Message>
          )}
          <Table withRowBorders aria-label="Strings" className="tune-table">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Charge, g</Table.Th>
                <Table.Th>Shots</Table.Th>
                <Table.Th>Mean, m/s</Table.Th>
                <Table.Th>SD, m/s</Table.Th>
                <Table.Th>Fit, m/s</Table.Th>
                <Table.Th>Fit minus mean</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {strings.map((s) => {
                const { n, mean, sd } = summary(s)
                const r = fit?.residuals.find((x) => Math.abs(x.grams - s.grams) < 1e-6)
                return (
                  <Table.Tr
                    key={`${s.grams}-${s.shots.join()}`}
                    data-invalid={s.grams === answer?.refusal?.grams || undefined}
                  >
                    <Table.Td>{s.grams.toFixed(2)}</Table.Td>
                    <Table.Td>{n}</Table.Td>
                    <Table.Td>{mean.toFixed(1)}</Table.Td>
                    <Table.Td>{sd.toFixed(1)}</Table.Td>
                    <Table.Td>{r ? r.predicted.toFixed(1) : 'n/a'}</Table.Td>
                    <Table.Td>{r ? (r.predicted - r.observed).toFixed(1) : 'n/a'}</Table.Td>
                  </Table.Tr>
                )
              })}
            </Table.Tbody>
          </Table>
          <Group gap="xs" align="end" wrap="wrap">
            <TextInput
              label="Charge, g"
              value={form.grams}
              onChange={(e) => setForm({ ...form, grams: e.currentTarget.value })}
              w={90}
            />
            <TextInput
              label="Shot velocities, m/s"
              value={form.shots}
              onChange={(e) => setForm({ ...form, shots: e.currentTarget.value })}
              style={{ flex: 1, minWidth: 160 }}
            />
            <Button variant="default" onClick={add}>
              Add a string
            </Button>
          </Group>
        </section>
        <section aria-label="Result">
          <Chart curve={answer?.curve ?? []} hand={tuned ? hand : undefined} strings={strings} />
          <Text size="xs">{bandNote}</Text>
          {answer && answer.curve.length > 1 && <Unfired curve={answer.curve} strings={strings} />}
          {fit && (
            <>
              <Group gap="xs">
                <Badge variant="default">Range {fit.label}</Badge>
                <Text size="sm">
                  Peak pressure range +/- {(fit.halfWidth * 100).toFixed(0)} %
                  {fit.reasons.length > 0 &&
                    `: ${fit.reasons.map((r) => reasonWords[r] ?? r).join(', ')}`}
                </Text>
              </Group>
              {answer && (
                <Text size="xs" data-testid="timing">
                  Fit {answer.ms.fit.toFixed(0)} ms, band {answer.ms.band.toFixed(0)} ms, pressure
                  range {answer.ms.range.toFixed(0)} ms (in the worker).
                </Text>
              )}
              <Table withRowBorders aria-label="Fitted parameters" className="tune-table">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Value</Table.Th>
                    <Table.Th>Start</Table.Th>
                    <Table.Th>Fitted</Table.Th>
                    <Table.Th>Standard uncertainty</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {fit.parameters.map((p) => (
                    <Table.Tr key={p.name}>
                      <Table.Td>
                        {names[p.name].label}
                        {names[p.name].unit && `, ${names[p.name].unit}`}
                      </Table.Td>
                      <Table.Td>{shown(p.name, p.initial)}</Table.Td>
                      <Table.Td>{shown(p.name, p.value)}</Table.Td>
                      <Table.Td>{p.sigma === undefined ? 'n/a' : shown(p.name, p.sigma)}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
              <HandTuning
                fit={fit}
                values={values}
                redraw={redraw}
                onMove={move}
                onReset={() => {
                  setValues({})
                  setHand(undefined)
                }}
              />
            </>
          )}
          <Text size="xs">All values on this screen are simulations, not load data.</Text>
        </section>
      </div>
    </>
  )
}
