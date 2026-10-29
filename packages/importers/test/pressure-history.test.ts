import { describe, expect, it } from 'vitest'
import { parsePressureHistory } from '../src/index.ts'

const mpa = 'time (ms);pressure (MPa)\n0;10\n0.1;150\n0.2;300\n0.3;250\n0.4;120\n'

describe('parsePressureHistory', () => {
  it('reads the units from the header and stores s and bar', () => {
    const t = parsePressureHistory(mpa, { sensor: 'breech' })
    expect(t.time).toEqual([0, 1e-4, 2e-4, 3e-4, 4e-4])
    expect(t.pressureBar).toEqual([100, 1500, 3000, 2500, 1200])
    expect(t.sensor).toBe('breech')
    expect(t.units).toEqual({
      time: { unit: 'ms', source: 'file' },
      pressure: { unit: 'MPa', source: 'file' },
    })
    expect(t.warnings).toEqual([])
    expect(t.lowPass).toBeUndefined()
  })

  it('takes the units from the caller for a file without a header, with a decimal comma', () => {
    const t = parsePressureHistory('0,0;1000\n0,1;30000\n0,2;45000\n', {
      sensor: 'mean',
      timeUnit: 'ms',
      pressureUnit: 'psi',
    })
    expect(t.pressureBar[1]).toBeCloseTo(30000 * 0.06894757293168, 9)
    expect(t.units.pressure).toEqual({ unit: 'psi', source: 'caller' })
    expect(t.time[2]).toBeCloseTo(2e-4, 15)
  })

  it('uses the caller unit with a warning when the header names an unknown one', () => {
    const t = parsePressureHistory('t (ticks),p (bar)\n0,1\n1,2\n2,3\n', {
      sensor: 'base',
      timeUnit: 'us',
    })
    expect(t.warnings).toEqual([
      'time unit "ticks" in the file is unknown; using us as named by the caller',
    ])
    expect(t.time[1]).toBe(1e-6)
  })

  it('rejects a missing unit with a message that names the column', () => {
    expect(() =>
      parsePressureHistory('time (ms);pressure\n0;1\n1;2\n2;3\n', { sensor: 'breech' }),
    ).toThrow('pressure unit is missing: name the unit to import this file')
    expect(() =>
      parsePressureHistory('0;1\n1;2\n2;3\n', { sensor: 'breech', pressureUnit: 'bar' }),
    ).toThrow('time unit is missing')
  })

  it('rejects a unit that differs from the one the caller names', () => {
    expect(() => parsePressureHistory(mpa, { sensor: 'breech', pressureUnit: 'bar' })).toThrow(
      'pressure unit "MPa" in the file differs from bar named by the caller',
    )
  })

  it('reads a long header and a long cell that is no number in linear time', () => {
    const start = performance.now()
    const t = parsePressureHistory(
      `time ${'['.repeat(50_000)};pressure (MPa)\n0;10\n0.1;150\n0.2;300\n`,
      { sensor: 'breech', timeUnit: 'ms' },
    )
    expect(() =>
      parsePressureHistory(`time (ms);pressure (MPa)\n${'1'.repeat(50_000)}x;0\n0;10\n0.1;150\n`, {
        sensor: 'breech',
      }),
    ).toThrow('line 2: time or pressure is not a number')
    expect(performance.now() - start).toBeLessThan(500)
    expect(t.time).toEqual([0, 1e-4, 2e-4])
  })

  it('requires the sensor position', () => {
    expect(() => parsePressureHistory(mpa, {} as never)).toThrow('the sensor position is missing')
  })

  it('rejects a bad shape: text, decreasing times, too few samples, wrong columns', () => {
    const o = { sensor: 'breech', timeUnit: 's', pressureUnit: 'bar' } as const
    expect(() => parsePressureHistory('0;1\n1;x\n2;3\n', o)).toThrow(
      'line 2: time or pressure is not a number',
    )
    expect(() => parsePressureHistory('0;1\n1;2\n1;3\n', o)).toThrow('line 3: times must increase')
    expect(() => parsePressureHistory('0;1\n1;2\n', o)).toThrow('at least 3 samples')
    expect(() =>
      parsePressureHistory('0;1\n1;2\n2;3\n', { ...o, columns: { time: 1, pressure: 1 } }),
    ).toThrow('columns:')
    expect(() =>
      parsePressureHistory('0;1\n1;2\n2;3\n', { ...o, columns: { time: 0, pressure: 2 } }),
    ).toThrow('columns:')
  })

  it('reads other columns', () => {
    const t = parsePressureHistory('n;t (s);p [Pa]\n1;0;1e5\n2;1.0E-3;2e5\n3;2e-3;3e5\n', {
      sensor: 'breech',
      columns: { time: 2, pressure: 3 },
    })
    expect(t.time).toEqual([0, 1e-3, 2e-3])
    for (const [i, p] of t.pressureBar.entries()) expect(p).toBeCloseTo(i + 1, 12)
  })

  it('applies a zero-phase low-pass: smooths a spike, keeps a constant and the time of the peak', () => {
    const o = { sensor: 'breech', timeUnit: 's', pressureUnit: 'bar' } as const
    const n = 41
    const rows = (f: (i: number) => number) =>
      Array.from({ length: n }, (_, i) => `${i * 1e-5};${f(i)}`).join('\n')
    const flat = parsePressureHistory(
      rows(() => 500),
      { ...o, lowPass: { cutoff: 1e4 } },
    )
    expect(flat.pressureBar.every((p) => Math.abs(p - 500) < 1e-9)).toBe(true)
    expect(flat.lowPass).toEqual({ cutoff: 1e4 })
    const spike = parsePressureHistory(
      rows((i) => (i === 20 ? 1000 : 0)),
      { ...o, lowPass: { cutoff: 1e4 } },
    )
    expect(Math.max(...spike.pressureBar)).toBeLessThan(1000)
    expect(spike.pressureBar.indexOf(Math.max(...spike.pressureBar))).toBe(20)
    expect(spike.pressureBar[19]).toBeCloseTo(spike.pressureBar[21] as number, 3)
    expect(() =>
      parsePressureHistory(
        rows(() => 1),
        { ...o, lowPass: { cutoff: 0 } },
      ),
    ).toThrow('lowPass cutoff')
  })

  it('reads exponent notation, square-bracket units and ignores a header cell without a unit', () => {
    const t = parsePressureHistory('Time [ms];Pressure [kPa]\n0;1E+4\n1;2.5e4\n2;3e4\n', {
      sensor: 'mean',
    })
    expect(t.time).toEqual([0, 1e-3, 2e-3])
    expect(t.pressureBar).toEqual([100, 250, 300])
    const plain = parsePressureHistory('Time;Pressure\n0;1\n1;2\n2;3\n', {
      sensor: 'base',
      timeUnit: 'ms',
      pressureUnit: 'bar',
    })
    expect(plain.warnings).toEqual([])
  })

  it('does not read mPa or Mbar as another unit', () => {
    const o = { sensor: 'breech', timeUnit: 's' } as const
    for (const unit of ['mPa', 'Mbar'])
      expect(() => parsePressureHistory(`t (s);p (${unit})\n0;1\n1;2\n2;3\n`, o)).toThrow(
        'pressure unit is missing',
      )
    const t = parsePressureHistory('t (s);p (MPA)\n0;1\n1;2\n2;3\n', o)
    expect(t.units.pressure.unit).toBe('MPa')
  })

  it('reads a decimal comma and keeps the first sample of a headerless file', () => {
    const t = parsePressureHistory('0,000;12,5\n0,125;30\n0,250;20\n', {
      sensor: 'breech',
      timeUnit: 'ms',
      pressureUnit: 'bar',
    })
    expect(t.time).toEqual([0, 1.25e-4, 2.5e-4])
    expect(t.pressureBar).toEqual([12.5, 30, 20])
  })

  it('reads a unit as the last word, in leading or spaced brackets, with a micro sign and in lower case', () => {
    const o = { sensor: 'breech' } as const
    const units = (header: string) => parsePressureHistory(`${header}\n0;1\n1;2\n2;3\n`, o).units
    expect(units('time ms;peak pressure MPa')).toEqual({
      time: { unit: 'ms', source: 'file' },
      pressure: { unit: 'MPa', source: 'file' },
    })
    expect(units('[ms];p [] mpa').pressure.unit).toBe('MPa')
    expect(units('t (ms);p [] [mpa]').pressure.unit).toBe('MPa')
    expect(units('t][ms];p ( kPa )').time.unit).toBe('ms')
    expect(units('t (\u00b5s);p (bar)').time.unit).toBe('us')
    expect(units('t (\u03bcs);p (bar)').time.unit).toBe('us')
  })

  it('reads signed numbers and a fraction without a leading digit, rejects a number with a tail', () => {
    const o = { sensor: 'breech', timeUnit: 's', pressureUnit: 'bar' } as const
    expect(parsePressureHistory('-0;+1\n.25;2\n1;3\n', o).pressureBar).toEqual([1, 2, 3])
    expect(() => parsePressureHistory('0;1\n1;2x\n2;3\n', o)).toThrow(
      'line 2: time or pressure is not a number',
    )
  })

  it('skips a line of only white space', () => {
    const o = { sensor: 'breech', timeUnit: 's', pressureUnit: 'bar' } as const
    expect(parsePressureHistory('0;1\n  \n1;2\n2;3\n', o).time).toEqual([0, 1, 2])
  })

  it('gives a spike the peak of a one-pole filter run forwards and backwards', () => {
    const cutoff = 1e4
    const dt = 1e-5
    const rows = Array.from({ length: 41 }, (_, i) => `${i * dt};${i === 10 ? 1000 : 0}`).join('\n')
    const t = parsePressureHistory(rows, {
      sensor: 'breech',
      timeUnit: 's',
      pressureUnit: 'bar',
      lowPass: { cutoff },
    })
    // gain a per pass; the backward pass sums the forward decay (1 - a)^k twice
    const a = dt / (dt + 1 / (2 * Math.PI * cutoff))
    expect(t.pressureBar[10]).toBeCloseTo((1000 * a) / (2 - a), 6)
  })

  it('rejects a reading that is not finite, also after the unit factor', () => {
    const o = { sensor: 'breech', timeUnit: 's', pressureUnit: 'bar' } as const
    expect(() => parsePressureHistory('0;1\n1;1e309\n2;3\n', o)).toThrow(
      'line 2: time or pressure is not finite',
    )
    expect(() => parsePressureHistory('0;1\n1e309;2\n2;3\n', o)).toThrow('line 2:')
    expect(() =>
      parsePressureHistory('0;1\n1;1.7e308\n2;3\n', { ...o, pressureUnit: 'MPa' }),
    ).toThrow('line 2: time or pressure is not finite')
  })
})
