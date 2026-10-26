'use client'

import { ActionIcon, Button, Menu } from '@mantine/core'
import { useReducedMotion } from '@mantine/hooks'
import { toSi } from '@open-reloading/schema'
import type { ECharts } from 'echarts/core'
import {
  type CSSProperties,
  type RefObject,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { createPortal } from 'react-dom'
import { baseAt, flightAt, flightTime, type StripModel } from '../lib/barrel-strip.ts'
import {
  advance,
  curvePoint,
  defaultFactor,
  eventStep,
  type PlaybackEvent,
  type PlaybackResult,
  type PlaybackSample,
  playbackEvents,
  sampler,
  scrubSteps,
  segmentAt,
  slowFactors,
  timeScrub,
  travelScrub,
} from '../lib/playback.ts'
import { controlSize } from '../lib/theme.ts'
import { msText, percentText, type UnitSystem, withUnit } from '../lib/units.ts'
import { shownLength } from '../lib/workbench.ts'

const readouts = [
  ['time', 'Time'],
  ['travel', 'Travel'],
  ['velocity', 'Velocity'],
  ['pressure', 'Breech pressure'],
  ['burnt', 'Burnt'],
] as const
type Texts = Record<(typeof readouts)[number][0], string>
/** The readouts as one sentence, for the slider value text and the event status. */
const sentence = (x: Texts) =>
  `${x.time}: travel ${x.travel}, velocity ${x.velocity}, breech pressure ${x.pressure}, powder burnt ${x.burnt}`

/**
 * Playback outside React: time, factor and the frame loop. `draw` writes the page; `onPlaying`
 * is the only React update, on play and pause. With `reduce` Play shows the muzzle at once. A frame
 * lands on each of the `stops` (the events), so the marker is on an event line at the event time.
 * Play runs on `flight()` s past the muzzle time `end`, while the bullet flies out of view.
 */
function controller(
  end: number,
  stops: readonly number[],
  reduce: boolean,
  draw: (t: number) => void,
  onPlaying: (playing: boolean) => void,
  flight: () => number,
) {
  let frame = 0
  let last = 0
  let until = end
  const c = {
    t: 0,
    factor: defaultFactor(end),
    playing: false,
    play() {
      if (c.playing) return
      if (reduce) return c.seek(end)
      if (c.t >= end) c.t = 0
      until = end + flight()
      last = performance.now()
      frame = requestAnimationFrame(step)
      c.playing = true
      onPlaying(true)
    },
    pause() {
      cancelAnimationFrame(frame)
      if (!c.playing) return
      c.playing = false
      onPlaying(false)
    },
    seek(t: number) {
      c.pause()
      c.t = t
      draw(t)
    },
  }
  const step = (now: number) => {
    // a background tab gets no frames; at most 100 ms count per frame, so playback resumes there
    c.t = advance(c.t, Math.min(Math.max(now - last, 0), 100) / 1000 / c.factor, until, stops)
    last = now
    draw(c.t)
    if (c.t < until) frame = requestAnimationFrame(step)
    else c.pause()
  }
  return c
}

type Nodes = Map<string, Element>

/** Writes the strip's bullet, gas and powder for the sample `s` at time `t`; none without a strip. */
function drawStrip(
  nodes: Nodes,
  strip: StripModel | undefined,
  s: PlaybackSample,
  t: number,
  end: number,
  maxMean: number,
) {
  if (!strip) return
  const set = (key: string, name: string, value: string) =>
    nodes.get(key)?.setAttribute(name, value)
  const z = baseAt(strip, s.travel)
  // past the muzzle time only the bullet moves on; the values stay at the muzzle
  const flown = t > end ? flightAt(strip, s, t - end) : z
  set('bullet', 'transform', `translate(${flown.toFixed(3)} 0)`)
  set('gas', 'width', Math.max(z, 0).toFixed(3))
  set('gas', 'fill-opacity', (0.15 + (0.75 * s.meanPressure) / maxMean).toFixed(3))
  set('powder', 'width', ((1 - s.burntFraction) * strip.base).toFixed(3))
}

/** Puts the marker on the curve at time `t`; nothing while the chart is gone. */
function placeMarker(
  chart: ECharts | null,
  m: HTMLElement | null,
  segment: ReturnType<typeof segmentAt>,
  t: number,
  x: (s: PlaybackSample) => number,
  y: (s: PlaybackSample) => number,
) {
  // the chart is disposed when its page is hidden, before the new one draws
  const c = chart?.isDisposed() ? null : chart
  if (!c || !m) return
  const [cx, cy] = curvePoint(segment, t, x, y)
  const px = c.convertToPixel({ xAxisIndex: 0 }, cx)
  const py = c.convertToPixel({ yAxisIndex: 0 }, cy)
  m.style.transform = `translateX(${Number.isFinite(px) ? px.toFixed(2) : -10}px)`
  // the values beside the line, on its left past the middle of the chart
  m.toggleAttribute('data-flip', px > c.getWidth() / 2)
  m.style.setProperty('--dot', `${Number.isFinite(py) ? py.toFixed(2) : -10}px`)
}

/** Sets the track's and the strip's place in the row from the chart's x scale. */
function placeTrack(
  chart: ECharts | null,
  el: HTMLElement | null,
  points: PlaybackResult['points'],
  x: (s: PlaybackSample) => number,
  strip: StripModel | undefined,
  travelX: ((travel: number) => number) | undefined,
) {
  const c = chart?.isDisposed() ? null : chart
  const first = points[0]
  const last = points[points.length - 1]
  if (!c || !el || !first || !last) return
  const px = (v: number) => c.convertToPixel({ xAxisIndex: 0 }, v)
  const [t0, t1] = [px(x(first)), px(x(last))]
  const set = (name: string, v: number) =>
    Number.isFinite(v) && el.style.setProperty(name, `${v.toFixed(2)}px`)
  set('--track-x', t0)
  set('--track-w', t1 - t0)
  if (strip && travelX) {
    // the strip's drawing runs from 1 mm behind the head to 1 mm past the muzzle
    const at = (z: number) => px(travelX(toSi('length', z - strip.base)))
    const [a, b] = [at(-1), at(strip.muzzle + 1)]
    set('--strip-x', a)
    set('--strip-w', b - a)
  } else {
    el.style.removeProperty('--strip-x')
    el.style.removeProperty('--strip-w')
  }
}

/** Seconds after muzzle exit until the bullet base is past the right edge of the chart box. */
function flightOut(
  svg: Element | undefined,
  points: PlaybackResult['points'],
  strip: StripModel | undefined,
) {
  const box = svg?.closest('.rail-strip')?.getBoundingClientRect()
  const a = svg?.getBoundingClientRect()
  const muzzle = points[points.length - 1]
  if (!strip || !box || !a || !muzzle || a.width <= 0) return 0
  // 1 px past the edge: the outline's stroke reaches behind the base
  return flightTime(
    strip,
    muzzle,
    strip.view[0] + ((box.right + 1 - a.left) * strip.view[2]) / a.width,
  )
}

/**
 * One row under the interior chart: Play, the speed, and the time slider on the barrel strip with
 * the events as marks; and the live values at the marker of the interior chart: the record's case in its chamber with the seated bullet and
 * the bore to the muzzle, to scale along the axis and stretched across to the row, the bullet moved by the simulated travel. Playback writes the
 * page through refs, not React state; the chart's marker shows once played or scrubbed.
 */
export function ChartPlayback({
  r,
  strip,
  system,
  x,
  y,
  chart,
  stage,
  rail,
  plot,
  travelX,
  redraw,
}: {
  r: PlaybackResult
  strip?: StripModel | undefined
  system: UnitSystem
  /** The chart's x and first y value of a point: the dot is mixed from them, on the drawn curve. */
  x: (s: PlaybackSample) => number
  y: (s: PlaybackSample) => number
  chart: RefObject<ECharts | null>
  /** The box over the chart that holds the marker with the live values. */
  stage: HTMLElement | null
  /** The slot of the strip and the time slider: before the chart in the box, so its place never depends on mount order. */
  rail: HTMLElement | null
  /** The plot's left and right edges in the chart box, px: the strip spans the plot. */
  plot: readonly [number, number]
  /**
   * Display x of a bullet travel (m), on the travel axis only: the strip then lies on the chart's
   * x scale, the bullet under the marker. On the time axis the strip spans the plot.
   */
  travelX?: ((travel: number) => number) | undefined
  /** Set here: draws the current time again, after the chart drew. */
  redraw: { current?: (() => void) | undefined }
}) {
  const id = useId().replace(/:/g, '')
  const end = r.muzzleTime
  const [playing, setPlaying] = useState(false)
  const reduce = useReducedMotion(false, { getInitialValueInEffect: false })
  const nodes = useRef(new Map<string, Element>())
  const put = (key: string) => (e: Element | null) => {
    if (e) nodes.current.set(key, e)
    else nodes.current.delete(key)
  }
  const marker = useRef<HTMLDivElement>(null)
  const room = useRef<HTMLFieldSetElement>(null)
  const scrub = useRef<HTMLInputElement>(null)
  const pointer = useRef(false)
  const at = useMemo(() => sampler(r.points), [r])
  const segment = useMemo(() => segmentAt(r.points), [r])
  // the slider's scale follows the chart's x axis, so its thumb is under the marker on either: the
  // bullet's travel on the travel axis, the time on the time axis
  const byTravel = travelX !== undefined
  const scale = useMemo(
    () => (byTravel ? travelScrub(r.points) : timeScrub(end)),
    [r, byTravel, end],
  )
  const events = useMemo(() => playbackEvents(r), [r])
  const maxMean = useMemo(() => Math.max(...r.points.map((p) => p.meanPressure)), [r])
  const text = (s: PlaybackSample): Texts => ({
    time: msText(s.time),
    travel: shownLength('travel', system, s.travel),
    velocity: withUnit('velocity', system, s.velocity),
    pressure: withUnit('pressure', system, s.breechPressure),
    burnt: percentText(s.burntFraction),
  })

  /** Writes the state at time t into the page; no React update. */
  const draw = (t: number, active = true) => {
    const s = at(t)
    marker.current?.toggleAttribute('data-active', active)
    drawStrip(nodes.current, strip, s, t, end, maxMean)
    const shown = text(s)
    for (const [key] of readouts) {
      const node = nodes.current.get(key)
      if (node) node.textContent = shown[key]
    }
    if (scrub.current) {
      scrub.current.value = String(Math.round(scale.pos(Math.min(t, end)) * scrubSteps))
      scrub.current.setAttribute('aria-valuetext', sentence(shown))
    }
    for (const e of events)
      nodes.current.get(`event-${e.key}`)?.toggleAttribute('data-passed', e.time <= t)
    placeMarker(chart.current, marker.current, segment, t, x, y)
  }
  /**
   * Places the strip and the time track from the chart's own scales, after each chart draw: the
   * track spans ignition to the muzzle on the x axis, and on the travel axis the strip is to scale
   * with it (its chamber behind travel 0, left of the plot), the bullet under the marker.
   */
  const layout = () => placeTrack(chart.current, room.current, r.points, x, strip, travelX)
  /** Seconds after muzzle exit until the bullet base is past the right edge of the chart box. */
  const flight = () => flightOut(nodes.current.get('strip'), r.points, strip)
  const drawRef = useRef(draw)
  const flightRef = useRef(flight)
  const control = useRef<ReturnType<typeof controller>>(null)
  const started = useRef(false)
  control.current ??= controller(
    end,
    events.map((e) => e.time),
    reduce,
    (t) => {
      started.current = true
      drawRef.current(t)
    },
    setPlaying,
    () => flightRef.current(),
  )

  // after every commit (mount, play, pause, unit switch, axis switch): the latest draw, at the current time
  useLayoutEffect(() => {
    drawRef.current = draw
    flightRef.current = flight
    redraw.current = () => {
      layout()
      if (control.current) draw(control.current.t, started.current)
    }
    redraw.current()
  })

  // no autoplay: paused at ignition; unmounting stops a playback
  useEffect(() => {
    const c = control.current
    return () => c?.pause()
  }, [])

  const c = control.current
  /** Shows an event's time and announces it with the values once. */
  const goTo = (e: PlaybackEvent) => {
    c?.seek(e.time)
    const status = nodes.current.get('status')
    if (status) status.textContent = `${e.label} at ${sentence(text(at(e.time)))}`
  }
  const [factor, setFactor] = useState(() => defaultFactor(end))
  const playButton = (
    <ActionIcon
      variant="default"
      size={controlSize.row.icon}
      className="play-button"
      aria-label={playing ? 'Pause' : 'Play'}
      title={playing ? 'Pause' : 'Play the shot'}
      onClick={() => {
        if (!c) return
        if (c.playing) c.pause()
        else c.play()
      }}
    >
      <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
        <path d={playing ? 'M3 2h4v12H3zM9 2h4v12H9z' : 'M4 2l10 6-10 6z'} />
      </svg>
    </ActionIcon>
  )
  return (
    <>
      {rail &&
        createPortal(
          <fieldset
            ref={room}
            className="playback screen-only"
            aria-label="Playback"
            data-playing={playing || undefined}
            style={
              { '--plot-left': `${plot[0]}px`, '--plot-right': `${plot[1]}px` } as CSSProperties
            }
          >
            {/* the strip and the slider on the chart's x scale: the thumb is under the marker */}
            <div className="rail-strip">
              <div className="strip-room">
                {strip && (
                  <svg
                    ref={put('strip')}
                    className="barrel-strip"
                    viewBox={strip.view.join(' ')}
                    preserveAspectRatio="none"
                    aria-hidden="true"
                  >
                    <defs>
                      <clipPath id={`${id}-bore`}>
                        <path d={strip.cavity} />
                      </clipPath>
                    </defs>
                    <path className="strip-steel" d={strip.steel} />
                    <path className="strip-line" d={strip.outline} />
                    <g clipPath={`url(#${id}-bore)`}>
                      <rect
                        ref={put('gas')}
                        className="strip-gas"
                        x={0}
                        y={-50}
                        height={100}
                        width={0}
                      />
                      <rect
                        ref={put('powder')}
                        className="strip-powder"
                        x={0}
                        y={-50}
                        height={100}
                        width={strip.base}
                      />
                    </g>
                    <path className="strip-case" d={strip.cartridge} />
                    <g ref={put('bullet')} transform={`translate(${strip.base} 0)`}>
                      <path className="strip-bullet" d={strip.bullet} />
                    </g>
                  </svg>
                )}
              </div>
              <div className="play-time">
                <input
                  ref={scrub}
                  type="range"
                  aria-label={byTravel ? 'Bullet position' : 'Time from ignition'}
                  aria-keyshortcuts="PageUp PageDown"
                  title="Page Up and Page Down go to the events"
                  min={0}
                  max={scrubSteps}
                  step={1}
                  defaultValue={0}
                  // a focused slider whose value changes every frame would be announced every frame
                  onFocus={() => c?.pause()}
                  onPointerDown={() => {
                    pointer.current = true
                  }}
                  onPointerUp={() => {
                    pointer.current = false
                  }}
                  onPointerCancel={() => {
                    pointer.current = false
                  }}
                  onLostPointerCapture={() => {
                    pointer.current = false
                  }}
                  onKeyDown={(e) => {
                    pointer.current = false
                    if (!c || (e.key !== 'PageUp' && e.key !== 'PageDown')) return
                    e.preventDefault()
                    const next = eventStep(events, c.t, e.key === 'PageDown' ? 1 : -1)
                    if (next) goTo(next)
                  }}
                  onChange={(e) => {
                    const v = Number(e.target.value) / scrubSteps
                    const t = scale.time(v)
                    // a pointer within 1 % of the axis of an event mark takes the event's time;
                    // position 0 is ignition, not the shot start that is at the same position
                    const near =
                      pointer.current &&
                      v > 0 &&
                      events.find((ev) => Math.abs(scale.pos(ev.time) - v) < 0.01)
                    if (near) goTo(near)
                    else c?.seek(t)
                  }}
                />
                {/* the events as marks on the track; Page Up and Page Down or a pointer near one go there */}
                <ul className="play-marks" aria-hidden="true">
                  {events.map((e) => (
                    <li
                      key={e.key}
                      ref={put(`event-${e.key}`)}
                      style={{ '--at': scale.pos(e.time) } as CSSProperties}
                    />
                  ))}
                </ul>
              </div>
            </div>
            {/* right of the strip, in the gutter the plot's right edge leaves (plotEdges) */}
            <div className="play-controls">
              {playButton}
              <Menu position="top-start" withinPortal shadow="sm">
                <Menu.Target>
                  {/* thousands as k, so the widest factor fits the gutter */}
                  <Button
                    variant="default"
                    size={controlSize.row.button}
                    px={0}
                    className="play-speed"
                    aria-label={`Slow-down factor: ${factor}×`}
                    title={`Slowed down ${factor} times`}
                  >
                    {factor / 1000}k×
                  </Button>
                </Menu.Target>
                <Menu.Dropdown>
                  {slowFactors.map((f) => (
                    <Menu.Item
                      key={f}
                      aria-current={f === factor || undefined}
                      onClick={() => {
                        setFactor(f)
                        if (c) c.factor = f
                      }}
                    >
                      {f}×
                    </Menu.Item>
                  ))}
                </Menu.Dropdown>
              </Menu>
            </div>
            <p role="status" className="visually-hidden" ref={put('status')} />
          </fieldset>,
          rail,
        )}
      {stage &&
        createPortal(
          <div ref={marker} className="chart-marker screen-only">
            <dl className="play-readouts">
              {readouts.map(([key, label]) => (
                <div key={key}>
                  <dt>{label}</dt>
                  <dd ref={put(key)} />
                </div>
              ))}
            </dl>
          </div>,
          stage,
        )}
    </>
  )
}
