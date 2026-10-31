import { interior } from '@open-reloading/core'
import { describe, expect, it } from 'vitest'
import { english } from '../src/i18n/translate.ts'
import type { InteriorResponse } from '../src/lib/api-types.ts'
import { exampleInterior } from '../src/lib/example-data.ts'
import {
  alignedAxes,
  chartEvents,
  chartRows,
  chartSeries,
  eventLabelRows,
  interiorOption,
  limitLines,
  plotEdges,
  sampleAtX,
} from '../src/lib/interior-chart.ts'
import { interiorBody } from '../src/lib/interior-input.ts'
import type { PlaybackResult } from '../src/lib/playback.ts'
import { formatQuantity, presetUnits } from '../src/lib/units.ts'
import { defined } from './defined.ts'

const { load } = interiorBody(exampleInterior)
const run = (change: Partial<typeof exampleInterior> = {}): PlaybackResult => {
  const r = interior(interiorBody({ ...exampleInterior, ...change }).load)
  if (!r.valid) throw new Error(`example invalid: ${r.reason}`)
  return r
}
const r = run()
const mass = load.bullet.mass

describe('series', () => {
  for (const preset of ['metric-grains', 'us'] as const)
    it(`ends velocity and energy at the muzzle readouts (${preset})`, () => {
      const system = presetUnits(preset)
      const v = chartSeries(r.points, 'time', 'velocity', mass, system)
      const e = chartSeries(r.points, 'travel', 'energy', mass, system)
      expect(v.y.at(-1)).toBeCloseTo(system.velocity.fromSi(r.muzzleVelocity), 9)
      expect(e.y.at(-1)).toBeCloseTo(system.energy.fromSi(r.muzzleEnergy), 9)
      const shown = (q: 'velocity' | 'energy', y: number) =>
        formatQuantity(q, system, system[q].toSi(y))
      expect(shown('velocity', v.y.at(-1) ?? 0)).toBe(
        formatQuantity('velocity', system, r.muzzleVelocity),
      )
      expect(shown('energy', e.y.at(-1) ?? 0)).toBe(
        formatQuantity('energy', system, r.muzzleEnergy),
      )
    })

  it('puts time in ms and travel and pressure in the display units', () => {
    const system = presetUnits('us')
    const s = chartSeries(r.points, 'time', 'pressure', mass, system)
    expect(s.x.at(-1)).toBeCloseTo(r.muzzleTime * 1e3, 12)
    expect(Math.max(...s.y)).toBeCloseTo(system.pressure.fromSi(r.peakBreechPressure), 6)
    const t = chartSeries(r.points, 'travel', 'pressure', mass, system)
    expect(t.x.at(-1)).toBeCloseTo(system.length.fromSi(r.points.at(-1)?.travel ?? 0), 12)
  })
})

describe('chartEvents', () => {
  const z1 = exampleInterior.formZ1 as number

  it('gives 10 %, peak, 95 % burnt, burnout when in the barrel and muzzle, by time', () => {
    const keys = chartEvents(r, undefined, english.t).map((e) => e.key)
    // the example burns out past the muzzle, the same load in a 2 m barrel in it
    expect(r.burnout).toBeNull()
    expect(keys).toEqual(['tenPercent', 'peak', 'burnt', 'muzzle'])
    const long = run({ travel: 2 })
    expect(long.burnout).not.toBeNull()
    expect(chartEvents(long, undefined, english.t).map((e) => e.key)).toEqual([
      'tenPercent',
      'peak',
      'burnt',
      'burnout',
      'muzzle',
    ])
    expect(defined(chartEvents(r, undefined, english.t)[0]).time).toBe(r.tenPercentPressureTime)
  })

  // points of (time s, burnt fraction): 0 at 0, 0.5 at 1, 0.9 at 2, 1 at 4
  const synthetic = (
    burnt: [number, number][],
    over: Partial<PlaybackResult> = {},
  ): PlaybackResult =>
    ({
      ...r,
      points: burnt.map(([time, burntFraction]) => ({ time, burntFraction })),
      tenPercentPressureTime: 0,
      burnout: null,
      shotStartTime: 0.5,
      maxPressureTime: 2,
      muzzleTime: 5,
      ...over,
    }) as unknown as PlaybackResult
  const ramp: [number, number][] = [
    [0, 0],
    [1, 0.5],
    [2, 0.9],
    [4, 1],
  ]
  const timeOf = (e: PlaybackResult, key: string, z = 0.7) =>
    chartEvents(e, z, english.t).find((x) => x.key === key)?.time

  it('puts z1 and 95 % at the linear crossing of the burnt fraction', () => {
    // 0.7: 1 + (0.7 - 0.5) / (0.9 - 0.5) * 1 = 1.5; 0.95: 2 + (0.95 - 0.9) / (1 - 0.9) * 2 = 3
    const events = chartEvents(synthetic(ramp), 0.7, english.t)
    expect(events.map((e) => e.key)).toEqual(['z1', 'peak', 'burnt', 'muzzle'])
    expect(events.map((e) => e.time)).toEqual([
      expect.closeTo(1.5, 12),
      2,
      expect.closeTo(3, 12),
      5,
    ])
  })

  it('puts a crossing at the first point at that point, kept only from the shot start', () => {
    const first = synthetic(
      [
        [0.2, 0.96],
        [1, 1],
      ],
      { shotStartTime: 0.1 },
    )
    expect(timeOf(first, 'burnt')).toBe(0.2)
    expect(timeOf({ ...first, shotStartTime: 0.5 }, 'burnt')).toBeUndefined()
  })

  it('leaves out a fraction the burn never reaches', () => {
    const never = synthetic([
      [0, 0],
      [1, 0.5],
      [4, 0.9],
    ])
    expect(chartEvents(never, 0.7, english.t).map((e) => e.key)).toEqual(['peak', 'z1', 'muzzle'])
    expect(chartEvents(never, 0.95, english.t).map((e) => e.key)).toEqual(['peak', 'muzzle'])
  })

  it('keeps a crossing at the shot start and drops one exactly at the muzzle', () => {
    // 0.95 at time 2, reached on the first segment: 0 + (0.95 - 0) / (0.95 - 0) * 2
    const line: [number, number][] = [
      [0, 0],
      [2, 0.95],
    ]
    expect(timeOf(synthetic(line, { muzzleTime: 2.5 }), 'burnt')).toBe(2)
    expect(timeOf(synthetic(line, { muzzleTime: 2 }), 'burnt')).toBeUndefined()
    expect(timeOf(synthetic(line, { muzzleTime: 2, shotStartTime: 0 }), 'z1', 0.95)).toBeUndefined()
    expect(timeOf(synthetic(line, { muzzleTime: 3, shotStartTime: 2 }), 'burnt')).toBe(2)
  })

  it('leaves out z1 without a two-stage form or at 1', () => {
    expect(chartEvents(r, undefined, english.t).map((e) => e.key)).not.toContain('z1')
    expect(chartEvents(r, 1, english.t).map((e) => e.key)).not.toContain('z1')
  })

  it('leaves out z1 and 95 % that the bullet has not reached at the muzzle', () => {
    const short = run({ travel: 0.05 })
    expect(short.muzzleBurntFraction).toBeLessThan(z1)
    expect(chartEvents(short, z1, english.t).map((e) => e.key)).toEqual(
      expect.not.arrayContaining(['z1', 'burnt']),
    )
  })

  it('leaves out a 10 % time of 0, a missing burnout and 95 % burnt before the shot start', () => {
    const keys = chartEvents(
      {
        ...r,
        tenPercentPressureTime: 0,
        burnout: null,
        shotStartTime: r.muzzleTime,
      },
      undefined,
      english.t,
    ).map((e) => e.key)
    expect(keys).toEqual(['peak', 'muzzle'])
  })
})

describe('sampleAtX', () => {
  it('finds the travel of a point on the travel axis and the time on the time axis', () => {
    const system = presetUnits('metric-grains')
    const p = defined(r.points[Math.floor(r.points.length / 2)])
    const byTravel = sampleAtX(r.points, 'travel', system.length.fromSi(p.travel), system)
    expect(byTravel.travel).toBeCloseTo(p.travel, 9)
    expect(byTravel.velocity).toBeCloseTo(p.velocity, 6)
    expect(sampleAtX(r.points, 'time', p.time * 1e3, system).breechPressure).toBeCloseTo(
      p.breechPressure,
      0,
    )
  })

  it('takes the last point at travel 0, the shot start', () => {
    const system = presetUnits('metric-grains')
    const s = sampleAtX(r.points, 'travel', 0, system)
    expect(s.travel).toBe(0)
    expect(s.time).toBeCloseTo(r.shotStartTime, 9)
  })
})

describe('chartRows', () => {
  it('gives 20 rows from ignition to muzzle exit', () => {
    const rows = chartRows(r.points)
    expect(rows).toHaveLength(20)
    expect(defined(rows[0]).time).toBe(defined(r.points[0]).time)
    expect(rows.at(-1)?.time).toBe(r.muzzleTime)
  })
})

type Limit = NonNullable<InteriorResponse['limits']>[number]
const cip: Limit = {
  cartridge: '308-win',
  revised: '2008-09-23',
  symbol: 'Pmax',
  method: 'transducer',
  compared: true,
  pressure: 4.15e8,
}

describe('limitLines', () => {
  const system = presetUnits('metric-grains')
  it('draws the compared limit and its reference lines', () => {
    const lines = limitLines([{ ...cip, compared: false }, cip], system, english.t)
    expect(lines?.map((l) => l.label)).toEqual([
      'CIP Pmax 4150 bar',
      '85 % of CIP Pmax',
      '75 % of CIP Pmax',
    ])
    expect(lines?.map((l) => l.y)).toEqual(
      [4150, 4150 * 0.85, 4150 * 0.75].map((y) => expect.closeTo(y, 9)),
    )
    expect(lines?.some((l) => /safe/i.test(l.label))).toBe(false)
  })

  it('leaves out the source without a number and gives undefined without a compared limit', () => {
    expect(defined(limitLines([cip], system, english.t)?.[0]).label).toBe('CIP Pmax 4150 bar')
    expect(limitLines([{ ...cip, compared: false }], system, english.t)).toBeUndefined()
    expect(limitLines(undefined, system, english.t)).toBeUndefined()
  })
})

describe('interiorOption', () => {
  const theme = {
    pressure: '#p',
    velocity: '#v',
    energy: '#e',
    pressureText: '#pt',
    velocityText: '#vt',
    energyText: '#et',
    foreground: '#f',
    muted: '#m',
    border: '#b',
    grid: '#r',
    warning: '#w',
    background: '#g',
  }
  const system = presetUnits('us')
  const slower = run({ charge: exampleInterior.charge * 0.95 })
  const steps = [
    { n: 1, result: slower },
    { n: 2, result: r },
  ]
  const lines = limitLines(
    [{ compared: true, pressure: 4150e5, symbol: 'Pmax' } as never],
    system,
    english.t,
  )
  const option = (show: 'all' | 'pressure', x: 'travel' | 'time' = 'travel') =>
    interiorOption({
      steps,
      selected: 1,
      mass,
      x,
      show,
      lines,
      system,
      theme,
      animate: true,
      t: english.t,
    })

  it('lays the grid out on the plot edges the playback strip spans', () => {
    expect(plotEdges(1)).toEqual([56, 72])
    expect(plotEdges(3)).toEqual([56, 100])
    for (const [show, n] of [
      ['all', 3],
      ['pressure', 1],
    ] as const) {
      const { left, right } = option(show).grid
      expect([left, right]).toEqual(plotEdges(n))
    }
  })

  it('draws every quantity on its own axis under its unit, the selected step opaque with its end marker and its energy dashed', () => {
    const o = option('all')
    expect(o.yAxis.map((a) => a.name)).toEqual(['psi', 'ft/s', 'ft·lbf'])
    // one grid line is a tick of every axis
    const counts = o.yAxis.map((a) => a.max / a.interval)
    expect(new Set(counts).size).toBe(1)
    expect(o.xAxis.name).toBe('in')
    // the tick labels are text, not the border colour of the axis line
    expect(o.xAxis.axisLabel.color).toBe(theme.muted)
    expect(o.series).toHaveLength(6)
    const own = o.series.filter((s) => s.lineStyle.opacity === 1)
    expect(own.map((s) => s.name)).toEqual([
      'Step 2 breech pressure',
      'Step 2 velocity',
      'Step 2 energy',
    ])
    expect(own.map((s) => s.markPoint?.data.at(-1)?.symbol)).toEqual(['circle', 'rect', 'diamond'])
    expect(defined(own[1]).markPoint?.data.at(-1)?.coord).toEqual(defined(own[1]).data.at(-1))
    expect(own.map((s) => s.lineStyle.type)).toEqual(['solid', 'solid', [7, 4]])
  })

  it('ends the x axis 0.5 % of the range past the last muzzle of the steps', () => {
    const o = option('all', 'time')
    const last = Math.max(...steps.map((s) => (s.result.points.at(-1)?.time ?? 0) * 1e3))
    expect(o.xAxis.max).toBeCloseTo(last + (last - o.xAxis.min) * 5e-3, 9)
    const travel = system.length.fromSi(r.points.at(-1)?.travel ?? 0)
    expect(option('pressure').xAxis.max).toBeCloseTo(
      travel + (travel - option('pressure').xAxis.min) * 5e-3,
      9,
    )
  })

  it('takes a ladder of 300000 points', () => {
    const points = Array.from({ length: 300_000 }, (_, i) => defined(r.points[i % r.points.length]))
    const long = [{ n: 1, result: { ...r, points } }]
    const o = interiorOption({
      steps: long,
      selected: 0,
      mass,
      x: 'time',
      show: 'all',
      lines,
      system,
      theme,
      animate: false,
      t: english.t,
    })
    expect(o.xAxis.max).toBeGreaterThan(o.xAxis.min)
  })

  it('puts event lines and the limit lines once, on the selected pressure curve', () => {
    const marks = option('all').series.flatMap((s) => s.markLine?.data ?? [])
    expect(marks.filter((m) => 'xAxis' in m).map((m) => m.name)).toEqual(
      chartEvents(r, undefined, english.t).map((e) => e.key),
    )
    expect(marks.filter((m) => 'yAxis' in m).map((m) => m.label.formatter)).toEqual(
      lines?.map((l) => l.label),
    )
  })

  it('labels the limit at the left end and the margins at the right, the lower margin below its line', () => {
    const marks = option('pressure').series.flatMap((s) => s.markLine?.data ?? [])
    const limits = marks.filter((m) => 'yAxis' in m)
    expect(limits.map((m) => [m.yAxis, m.label.position])).toEqual([
      [defined(lines?.[0]).y, 'insideStartTop'],
      [defined(lines?.[1]).y, 'insideEndTop'],
      [defined(lines?.[2]).y, 'insideEndBottom'],
    ])
  })

  it('stretches the pressure axis to the limit line', () => {
    expect(defined(option('all').yAxis[0]).max).toBeGreaterThanOrEqual(
      Math.max(...(lines ?? []).map((l) => l.y)),
    )
  })

  it('gives every event label of the example but the 10 % line a place', () => {
    const marks = option('all').series.flatMap((s) => s.markLine?.data ?? [])
    const events = marks.filter((m) => 'xAxis' in m)
    expect(events.find((m) => m.name === 'tenPercent')?.label.formatter).toBe('')
    const labels = events.filter((m) => m.name !== 'tenPercent').map((m) => m.label.formatter)
    expect(labels.length).toBeGreaterThan(0)
    expect(labels.every((l) => l.trim() !== '')).toBe(true)
  })

  it('puts the selected step peak dot at its own peak, also below a close higher one, without a label', () => {
    const close = run({ charge: exampleInterior.charge * 0.999 })
    const o = interiorOption({
      steps: [
        { n: 1, result: close },
        { n: 2, result: r },
      ],
      selected: 0,
      mass,
      x: 'travel',
      show: 'pressure',
      lines,
      system,
      theme,
      animate: true,
      t: english.t,
    })
    const marks = o.series.flatMap((s) => s.markPoint?.data ?? [])
    expect(marks.map((m) => m.name)).toEqual(['Step 1 peak', 'Step 1 end'])
    expect(defined(marks[0]).coord[1]).toBeCloseTo(
      system.pressure.fromSi(close.peakBreechPressure),
      6,
    )
    expect(defined(marks[0]).label?.show).toBe(false)
  })

  it('switches animation off when asked', () => {
    expect(
      interiorOption({
        steps,
        selected: 1,
        mass,
        x: 'travel',
        show: 'all',
        lines,
        system,
        theme,
        animate: false,
        t: english.t,
      }).animation,
    ).toBe(false)
  })
})

describe('alignedAxes', () => {
  it('gives every axis one count of nice intervals, the count that wastes least room', () => {
    // a limit of 60191 psi, 2393 ft/s, 2136 ft·lbf: 5 intervals; 4 would put the pressure axis at 80000
    expect(alignedAxes([60191, 2393, 2136])).toEqual([
      { max: 75000, interval: 15000 },
      { max: 2500, interval: 500 },
      { max: 2500, interval: 500 },
    ])
    // 41.0 gr of the example: 6 intervals keep 500 ft/s steps
    expect(alignedAxes([60191, 2651, 2621]).map((a) => a.max)).toEqual([90000, 3000, 3000])
    for (const maxima of [[1], [415, 830, 2900], [0.37, 1.2e4, 5]]) {
      const axes = alignedAxes(maxima)
      expect(new Set(axes.map((a) => Math.round(a.max / a.interval))).size).toBe(1)
      for (const [i, a] of axes.entries()) expect(a.max).toBeGreaterThanOrEqual(defined(maxima[i]))
    }
  })
})

describe('eventLabelRows', () => {
  const ev = (key: 'tenPercent' | 'z1' | 'peak' | 'burnt' | 'burnout' | 'muzzle', x: number) => ({
    key,
    label: {
      tenPercent: '10 %',
      z1: 'z1',
      peak: 'peak',
      burnt: '95 %',
      burnout: 'burnout',
      muzzle: 'muzzle',
    }[key],
    x,
  })

  it('puts well separated labels in the top row', () => {
    const rows = eventLabelRows(
      [ev('tenPercent', 0), ev('z1', 0.2), ev('peak', 0.4), ev('burnt', 0.6), ev('burnout', 0.8)],
      1,
    )
    expect([...rows.values()]).toEqual([0, 0, 0, 0, 0])
  })

  it('keeps the more important of close labels in the row and drops the others', () => {
    // widths: "10 %" 0.082, "z1" 0.046, "peak" 0.082 of the axis; z1 [0.007, 0.053], peak [0.019, 0.101]
    const rows = eventLabelRows([ev('tenPercent', 0), ev('z1', 0.03), ev('peak', 0.06)], 1)
    expect(rows.get('peak')).toBe(0)
    // their lines stay
    expect(rows.has('z1')).toBe(false)
    expect(rows.has('tenPercent')).toBe(false)
  })

  it('leaves no two labels of a row overlapping, whatever the clustering', () => {
    const widths = {
      tenPercent: 0.082,
      z1: 0.046,
      peak: 0.082,
      burnt: 0.082,
      burnout: 0.136,
      muzzle: 0.118,
    }
    const keys = Object.keys(widths) as (keyof typeof widths)[]
    for (let seed = 1; seed <= 200; seed++) {
      const spread = (seed % 10) / 40
      const events = keys.map((key, i) => ev(key, 0.3 + spread * ((i * seed) % 6)))
      const rows = eventLabelRows(events, 1)
      const spans = events.flatMap((e) => {
        const row = rows.get(e.key)
        const w = widths[e.key]
        const from = e.key === 'muzzle' ? e.x - w : e.x - w / 2
        return row === undefined ? [] : [{ row, from, to: from + w }]
      })
      for (const [i, a] of spans.entries())
        for (const b of spans.slice(i + 1))
          if (a.row === b.row) expect(a.to <= b.from || b.to <= a.from).toBe(true)
      expect(Math.max(...rows.values())).toBe(0)
    }
  })

  it('ends the muzzle label at its line', () => {
    // muzzle "muzzle" 0.118 wide spans [0.882, 1]; burnout 0.136 wide centred at 0.85 spans [0.782, 0.918]
    const rows = eventLabelRows([ev('burnout', 0.85), ev('muzzle', 1)], 1)
    expect([rows.get('muzzle'), rows.get('burnout')]).toEqual([0, undefined])
    expect(eventLabelRows([ev('burnout', 0.7), ev('muzzle', 1)], 1).get('burnout')).toBe(0)
  })
})
