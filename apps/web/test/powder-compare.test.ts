import type { Powder } from '@open-reloading/schema'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { answerRow, computeRows } from '../src/components/use-powder-compare.ts'
import { fetchPowder, postInteriorRun, postJson } from '../src/lib/api-client.ts'
import { runBatch } from '../src/lib/batch.ts'
import { noComparableLimitText, targetError, targetUnit } from '../src/lib/charge-target.ts'
import { exampleInterior } from '../src/lib/example-data.ts'
import { interiorBody } from '../src/lib/interior-input.ts'
import {
  compareCharge,
  compareKey,
  distinctValues,
  filterPowderRows,
  powderValues,
  sortForMode,
  sortPowderRows,
} from '../src/lib/powder-compare.ts'
import { defined } from './defined.ts'

// these tests stub `fetch` as the API's own answers: the browser's calls go to it as written, in place of the data files and the compute worker
vi.mock('../src/lib/static-api.ts', () => ({
  staticFetch: (path: string, init?: RequestInit) => fetch(`/api/${path}`, init),
}))

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('runBatch', () => {
  it('keeps at most `limit` tasks in flight and runs every item', async () => {
    let flying = 0
    let most = 0
    const seen: number[] = []
    await runBatch(
      [1, 2, 3, 4, 5, 6, 7],
      3,
      new AbortController().signal,
      async (n) => {
        flying++
        most = Math.max(most, flying)
        await new Promise((r) => setTimeout(r, 5))
        flying--
        return n * 2
      },
      (_i, result) => seen.push(result),
    )
    expect(most).toBe(3)
    expect(seen.sort((a, b) => a - b)).toEqual([2, 4, 6, 8, 10, 12, 14])
  })

  it('starts nothing once aborted and reports the count done', async () => {
    const abort = new AbortController()
    const counts: number[] = []
    await runBatch(
      Array.from({ length: 10 }, (_, i) => i),
      1,
      abort.signal,
      async () => {},
      (_i, _r, done) => {
        counts.push(done)
        if (done === 4) abort.abort()
      },
    )
    expect(counts).toEqual([1, 2, 3, 4])
  })
})

describe('runBatch with a failing task', () => {
  it('lets the other workers finish before it throws the first error', async () => {
    const finished: number[] = []
    await expect(
      runBatch([1, 2, 3, 4, 5, 6], 3, new AbortController().signal, async (n) => {
        await new Promise((r) => setTimeout(r, n === 1 ? 1 : 20))
        if (n === 1) throw new Error('row')
        finished.push(n)
      }),
    ).rejects.toThrow('row')
    // nothing is left running when the batch settles
    expect(finished.sort((a, b) => a - b)).toEqual([2, 3, 4, 5, 6])
  })
})

describe('compareCharge', () => {
  it('is the typed charge in typed mode, bulk density or not', () => {
    expect(compareCharge({ kind: 'typed' }, 0.0031, undefined, 3e-6)).toBe(0.0031)
  })

  it('is the fraction of the free volume at the bulk density, g/cm3 to kg/m3', () => {
    // 90 % of 3 cm3 at 0.9 g/cm3 is 2.43 g
    expect(compareCharge({ kind: 'fill', fill: 0.9 }, 0.0031, 0.9, 3e-6)).toBeCloseTo(0.00243, 12)
  })

  it('is undefined for a fill without a bulk density', () => {
    expect(compareCharge({ kind: 'fill', fill: 1 }, 0.0031, undefined, 3e-6)).toBeUndefined()
  })
})

describe('powderValues', () => {
  const rec = (id: string, vivacity: number) =>
    ({
      id,
      interior: {
        energy: { value: 4e6 },
        gamma: 1.24,
        density: { value: 1.6 },
        covolume: { value: 0.001 },
        vivacity: { value: vivacity },
        pressureExponent: 1,
        referencePressure: { value: 1 },
        ignitionPressure: { value: 50 },
        startPressure: { value: 250 },
        burnForm: { kind: 'twoStage', a: { value: 0.8 }, m: 0.5, q: 0.5, z1: 0.8 },
      },
    }) as unknown as Powder
  // the user edited the vivacity and the ignition pressure of the chosen powder
  const fields = { vivacity: 0.9, ignitionPressure: 1e6, charge: 0.003, mass: 0.01 }

  it('keeps the fields as they stand for the chosen powder, the edits included', () => {
    expect(powderValues(fields, { id: 'p1' })).toEqual(fields)
    expect(powderValues(fields, { id: 'p1' }, { powder: rec('p1', 0.5) })).toEqual(fields)
  })

  it('takes the charge of the row for the chosen powder as well', () => {
    expect(powderValues(fields, { id: 'p1' }, { powder: rec('p1', 0.5), charge: 0.0025 })).toEqual({
      ...fields,
      charge: 0.0025,
    })
  })

  it('lays the record of another powder over the model fields and keeps the rest', () => {
    const v = powderValues(fields, { id: 'p1' }, { powder: rec('p2', 0.5), charge: 0.0025 })
    expect(v).toMatchObject({ vivacity: 0.5, ignitionPressure: 5e6, charge: 0.0025, mass: 0.01 })
    expect(powderValues(fields, undefined, { powder: rec('p2', 0.5) }).vivacity).toBe(0.5)
  })
})

describe('compareKey', () => {
  const body = interiorBody(exampleInterior, 'x')
  const inputs = ['p1', 0.03, 7.8, 7.7]
  const key = compareKey(body, { kind: 'typed' }, inputs)

  it('changes with the model fields of the load, which the current powder row reads', () => {
    const scale = (
      b: typeof body,
      k: 'specificEnergy' | 'vivacity' | 'exponent' | 'startPressure' | 'ignitionPressure',
    ) => {
      const owner = (k === 'specificEnergy'
        ? b.load.propellant
        : k.endsWith('Pressure')
          ? b.load
          : b.load.propellant.burn) as unknown as Record<string, number>
      expect(owner[k], k).toBeTypeOf('number')
      owner[k] = defined(owner[k]) * 1.1
    }
    for (const k of [
      'specificEnergy',
      'vivacity',
      'exponent',
      'startPressure',
      'ignitionPressure',
    ] as const) {
      const other = structuredClone(body)
      scale(other, k)
      expect(compareKey(other, { kind: 'typed' }, inputs), k).not.toBe(key)
    }
  })

  it('changes with what the bore resistance of a record reads and with the chosen powder', () => {
    for (let i = 0; i < inputs.length; i++) {
      const other = [...inputs]
      other[i] = typeof other[i] === 'string' ? 'p2' : (other[i] as number) * 1.01
      expect(compareKey(body, { kind: 'typed' }, other)).not.toBe(key)
    }
  })

  it('changes with the load, the cartridge, the typed charge and the mode', () => {
    const volume = structuredClone(body)
    volume.load.chamber.volume *= 1.01
    expect(compareKey(volume, { kind: 'typed' }, inputs)).not.toBe(key)
    expect(compareKey({ ...body, cartridge: 'y' }, { kind: 'typed' }, inputs)).not.toBe(key)
    const charge = structuredClone(body)
    charge.load.charge *= 1.01
    expect(compareKey(charge, { kind: 'typed' }, inputs)).not.toBe(key)
    expect(compareKey(body, { kind: 'fill', fill: 0.9 }, inputs)).not.toBe(key)
    // a fill does not depend on the typed charge
    expect(compareKey(charge, { kind: 'fill', fill: 0.9 }, inputs)).toBe(
      compareKey(body, { kind: 'fill', fill: 0.9 }, inputs),
    )
  })
})

describe('compareKey in the target mode', () => {
  const body = interiorBody(exampleInterior, 'x')
  const inputs = ['p1']
  const target = { kind: 'target', value: 3.5e8, percent: false } as const
  const key = compareKey(body, target, inputs)

  it('changes with the target value and with its unit, not with the typed charge', () => {
    expect(compareKey(body, { ...target, value: 3.6e8 }, inputs)).not.toBe(key)
    expect(compareKey(body, { ...target, percent: true }, inputs)).not.toBe(key)
    expect(compareKey(body, { kind: 'typed' }, inputs)).not.toBe(key)
    const charge = structuredClone(body)
    charge.load.charge *= 1.1
    expect(compareKey(charge, target, inputs)).toBe(key)
  })

  it('leaves the charge of a powder to the solver', () => {
    expect(compareCharge(target, 0.0025, undefined, 3e-6)).toBe(0.0025)
  })
})

describe('answerRow', () => {
  const head = { id: 'p1', manufacturerName: 'M', name: 'N' }
  const body = interiorBody(exampleInterior, 'x')
  const answer = {
    result: {
      peakBreechPressure: 3.4e8,
      muzzleVelocity: 800,
      muzzleBurntFraction: 0.97,
      burnout: null,
      points: [],
    },
    pressureRange: { nominalPressure: 3.5e8, lowPressure: 3.2e8, highPressure: 3.8e8 },
    limits: undefined,
    warnings: [],
  } as never

  it('reads the pressure range, the velocity and the case fill at the charge found', () => {
    const row = answerRow(head, { body, bulkDensity: 900 }, 0.003, answer)
    const volume = body.load.chamber.volume
    expect(row.charge).toBe(0.003)
    expect(row.values).toMatchObject({
      peak: 3.5e8,
      velocity: 800,
      burnt: 0.97,
      burnout: undefined,
      range: { low: 3.2e8, high: 3.8e8 },
    })
    // the typed charge of the load is not the one the ratio reads
    expect(row.ratio).toBeCloseTo(0.003 / (900 * volume), 10)
    expect(row.reason).toBeUndefined()
  })

  it('gives a row with the reason when the answer cannot be read', () => {
    const row = answerRow(head, { body }, 0.003, {} as never)
    expect(row.values).toBeUndefined()
    expect(row.reason).toBeTruthy()
  })
})

describe('postJson', () => {
  it('keeps the body of a 422 as the refusal and the message as the reason', async () => {
    const refusal = { reason: 'aboveRange', message: 'charge solver: aboveRange' }
    vi.stubGlobal('fetch', async () => new Response(JSON.stringify(refusal), { status: 422 }))
    expect(await postJson('/api/x', {}, new AbortController().signal)).toEqual({
      reason: 'charge solver: aboveRange',
      refusal,
    })
  })

  it('gives no refusal for a deadline, another status or a lost connection', async () => {
    vi.stubGlobal(
      'fetch',
      async () => new Response(JSON.stringify({ message: 'no' }), { status: 404 }),
    )
    expect(await postJson('/api/x', {}, new AbortController().signal)).toEqual({ reason: 'no' })
    vi.stubGlobal('fetch', async () => new Response('x', { status: 500 }))
    expect(await postJson('/api/x', {}, new AbortController().signal)).toEqual({
      reason: 'The API answered 500.',
    })
  })
})

describe('fetchPowder', () => {
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })

  it('gives the record, and undefined for a record the API does not know', async () => {
    vi.stubGlobal('fetch', async (url: string) =>
      url.endsWith('/known') ? json({ id: 'known' }) : json({}, 404),
    )
    const signal = new AbortController().signal
    expect(await fetchPowder('known', signal)).toEqual({ id: 'known' })
    expect(await fetchPowder('gone', signal)).toBeUndefined()
  })

  it('throws on any other refusal, so the row says the API did not answer', async () => {
    vi.stubGlobal('fetch', async () => json({ message: 'busy' }, 503))
    await expect(fetchPowder('other', new AbortController().signal)).rejects.toThrow(
      'The API answered 503.',
    )
  })
})

describe('filters and sort', () => {
  const rows = [
    { id: 'a', manufacturerName: 'Alpha', base: 'double', form: 'extruded', v: 3 },
    { id: 'b', manufacturerName: 'Bravo', base: 'single', form: 'ball', v: undefined },
    { id: 'c', manufacturerName: 'Bravo', form: 'ball', v: 1 },
  ]

  it('lists the distinct values of a facet, sorted, without the missing ones', () => {
    expect(distinctValues(rows, 'manufacturerName')).toEqual(['Alpha', 'Bravo'])
    expect(distinctValues(rows, 'base')).toEqual(['double', 'single'])
  })

  it('keeps the rows that match every chosen filter', () => {
    expect(
      filterPowderRows(rows, { manufacturerName: 'Bravo', base: '', form: 'ball' }).map(
        (r) => r.id,
      ),
    ).toEqual(['b', 'c'])
    expect(
      filterPowderRows(rows, { manufacturerName: 'Bravo', base: 'single', form: '' }).map(
        (r) => r.id,
      ),
    ).toEqual(['b'])
  })

  it('sorts by a column with the rows without a value last, in both directions', () => {
    const value = () => (r: (typeof rows)[number]) => r.v
    expect(sortPowderRows(rows, { column: 'v', dir: 'ascending' }, value).map((r) => r.id)).toEqual(
      ['c', 'a', 'b'],
    )
    expect(
      sortPowderRows(rows, { column: 'v', dir: 'descending' }, value).map((r) => r.id),
    ).toEqual(['a', 'c', 'b'])
    expect(sortPowderRows(rows, undefined, value).map((r) => r.id)).toEqual(['a', 'b', 'c'])
  })
})

describe('postRun', () => {
  const answer = { result: { points: [1, 2], peakBreechPressure: 1 }, pressureRange: {} }
  const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
    new Response(JSON.stringify(body), { status, headers })

  it('returns the answer without its points', async () => {
    vi.stubGlobal('fetch', async () => json(answer))
    const r = await postInteriorRun({}, new AbortController().signal)
    expect(r && 'answer' in r && r.answer.result.points).toEqual([])
  })

  it('asks again after a busy pool and gives the answer', async () => {
    vi.useFakeTimers()
    const calls: number[] = []
    vi.stubGlobal('fetch', () => {
      calls.push(1)
      return Promise.resolve(
        calls.length < 3
          ? json({ reason: 'busy', message: 'busy' }, 503, { 'retry-after': '1' })
          : json(answer),
      )
    })
    const pending = postInteriorRun({}, new AbortController().signal)
    await vi.advanceTimersByTimeAsync(2500)
    const r = await pending
    expect(calls).toHaveLength(3)
    expect(r && 'answer' in r).toBe(true)
  })

  it('gives the API message of a refused run and no retry', async () => {
    const fetcher = vi.fn(async () => json({ message: 'interior: stuck' }, 422))
    vi.stubGlobal('fetch', fetcher)
    expect(await postInteriorRun({}, new AbortController().signal)).toEqual({
      reason: 'interior: stuck',
      refusal: { message: 'interior: stuck' },
    })
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('names a deadline and a lost connection', async () => {
    vi.stubGlobal('fetch', async () => json({ reason: 'timeout' }, 503))
    expect(await postInteriorRun({}, new AbortController().signal)).toEqual({
      reason: 'The run passed the API deadline.',
    })
    vi.stubGlobal('fetch', () => Promise.reject(new TypeError('network')))
    expect(await postInteriorRun({}, new AbortController().signal)).toEqual({
      reason: 'The API did not answer.',
    })
  })

  it('returns at once when aborted while a busy answer is read', async () => {
    vi.useFakeTimers()
    const abort = new AbortController()
    vi.stubGlobal('fetch', () => {
      const res = json({ reason: 'busy', message: 'busy' }, 503, { 'retry-after': '30' })
      // the abort lands between the answer and the wait for the pool
      queueMicrotask(() => abort.abort())
      return Promise.resolve(res)
    })
    const pending = postInteriorRun({}, abort.signal)
    // no timer advance: the 30 s wait must not be entered
    expect(await pending).toBeUndefined()
  })

  it('returns nothing when aborted', async () => {
    const abort = new AbortController()
    vi.stubGlobal('fetch', () => {
      abort.abort()
      return Promise.reject(new DOMException('aborted', 'AbortError'))
    })
    expect(await postInteriorRun({}, abort.signal)).toBeUndefined()
  })
})

describe('sortForMode', () => {
  it('moves a sort on the peak to the range column in the target mode and back', () => {
    const peak = { column: 'peak', dir: 'descending' } as const
    expect(sortForMode(peak, true)).toEqual({ column: 'range', dir: 'descending' })
    expect(sortForMode({ column: 'range', dir: 'ascending' }, false)).toEqual({
      column: 'peak',
      dir: 'ascending',
    })
  })

  it('keeps every other sort and no sort', () => {
    const velocity = { column: 'velocity', dir: 'ascending' } as const
    expect(sortForMode(velocity, true)).toBe(velocity)
    expect(sortForMode(velocity, false)).toBe(velocity)
    expect(sortForMode(undefined, true)).toBeUndefined()
  })
})

describe('targetError', () => {
  const mpa = {
    symbol: 'MPa',
    toSi: (x: number) => x * 1e6,
    fromSi: (x: number) => x / 1e6,
    decimals: 0,
  }
  const percent = targetUnit('peakPressure', {} as never, true)

  it('names the unit shown for an empty, zero or negative target', () => {
    expect(targetError('', mpa)).toBe('Enter a target above 0 MPa.')
    expect(targetError(0, mpa)).toBe('Enter a target above 0 MPa.')
    expect(targetError('-3', mpa)).toBe('Enter a target above 0 MPa.')
    expect(targetError('x', percent)).toBe('Enter a target above 0 % of Pmax.')
  })

  it('refuses a target above what the API accepts, in the unit shown', () => {
    expect(targetError(3e6 + 1, mpa)).toBe('Enter a target of at most 1000000 MPa.')
    expect(targetError(1e12, percent)).toBeUndefined()
    expect(targetError(1e12 + 1, percent)).toBe(
      'Enter a target of at most 1000000000000 % of Pmax.',
    )
    expect(targetError(Number.POSITIVE_INFINITY, percent)).toMatch(/at most/)
  })

  it('accepts a target in range, typed text included', () => {
    expect(targetError('350', mpa)).toBeUndefined()
    expect(targetError(90.5, percent)).toBeUndefined()
  })
})

describe('postJson cut by an abort', () => {
  it('gives nothing when the abort lands while the body is read', async () => {
    const abort = new AbortController()
    vi.stubGlobal('fetch', () => {
      const res = new Response('{}', { status: 200 })
      res.json = () => {
        abort.abort()
        return Promise.reject(new DOMException('aborted', 'AbortError'))
      }
      return Promise.resolve(res)
    })
    expect(await postJson('/api/x', {}, abort.signal)).toBeUndefined()
  })
})

describe('computeRows in the target mode', () => {
  const body = interiorBody(exampleInterior, 'x')
  const loadRequest = (as?: { powder: Powder }) => ({
    body,
    bulkDensity: as?.powder.bulkDensity && as.powder.bulkDensity.value * 1e3,
    recordInputs: [],
  })
  const target = { kind: 'target', value: 3.5e8, percent: false } as const
  // the records are kept for the session: a new set of ids for each API
  let set = 0
  const summary = (i: number, interior = true) => ({
    id: `target-${set}-${i}`,
    manufacturer: 'm',
    name: `N${i}`,
    interior,
  })
  const found = {
    charge: 0.003,
    result: {
      peakBreechPressure: 3.5e8,
      muzzleVelocity: 800,
      muzzleBurntFraction: 0.97,
      burnout: null,
    },
    pressureRange: { nominalPressure: 3.5e8, lowPressure: 3.2e8, highPressure: 3.8e8 },
    warnings: [],
  }
  const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status })

  /** The API: a list of `n` powders (the first without model parameters), `solve` answers each charge request. */
  function api(n: number, solve: () => Promise<Response>, density?: number) {
    const requests: string[] = []
    set++
    // biome-ignore lint/suspicious/useAwait: stands in for fetch, an aborted signal rejects rather than throws
    vi.stubGlobal('fetch', async (url: string, init?: { signal?: AbortSignal }) => {
      if (url === '/api/manufacturers') return json({ total: 1, items: [{ id: 'm', name: 'M' }] })
      if (url.startsWith('/api/powders?'))
        return json({ total: n, items: Array.from({ length: n }, (_, i) => summary(i, i > 0)) })
      if (url.startsWith('/api/powders/')) {
        const id = decodeURIComponent(url.slice('/api/powders/'.length))
        return json({
          id,
          manufacturer: 'm',
          name: id,
          interior: {},
          ...(density && { bulkDensity: { value: density } }),
        })
      }
      requests.push(url)
      init?.signal?.throwIfAborted()
      return solve()
    })
    return requests
  }

  it('marks no row of a powder with a bulk density and a charge within the limit', async () => {
    // a load ratio of 1 at 0.9 g/cm3
    const charge = 900 * body.load.chamber.volume
    api(2, async () => json({ ...found, charge }), 0.9)
    const done = await computeRows(
      loadRequest as never,
      loadRequest() as never,
      target,
      new AbortController().signal,
      {
        start: () => {},
        done: () => {},
      },
    )
    expect(defined(done?.rows[1]).flag).toBeUndefined()
  })

  it('stops after the first answer that the cartridge has no comparable limit', async () => {
    const requests = api(
      40,
      async () => json({ reason: 'noComparableLimit', message: 'x has no CIP Pmax' }, 422),
      0.9,
    )
    const done = await computeRows(
      loadRequest as never,
      loadRequest() as never,
      { ...target, percent: true },
      new AbortController().signal,
      { start: () => {}, done: () => {} },
    )
    // the requests in flight, not one per powder
    expect(requests.length).toBeLessThanOrEqual(3)
    expect(done?.noLimit?.reason).toBe('noComparableLimit')
    expect(done?.rows).toHaveLength(40)
    expect(defined(done?.rows[0]).reason).toBe('No fitted model parameters')
    for (const r of done?.rows.slice(1) ?? []) {
      expect(r.values).toBeUndefined()
      expect(r.refusal?.reason).toBe('noComparableLimit')
    }
    expect(noComparableLimitText).toMatch(/no CIP limit/)
  })

  it('gives no row and asks nothing more after a cancel', async () => {
    const abort = new AbortController()
    let answered = 0
    const requests = api(
      30,
      () => {
        answered++
        // the cancel lands while the first answers are in flight
        if (answered === 3) abort.abort()
        return Promise.resolve(json(found))
      },
      0.9,
    )
    const rows: number[] = []
    const done = await computeRows(
      loadRequest as never,
      loadRequest() as never,
      target,
      abort.signal,
      {
        start: () => {},
        done: (_n, _total, now) => rows.push(now().length),
      },
    )
    expect(done?.noLimit).toBeUndefined()
    expect(requests.length).toBeLessThanOrEqual(3 + 3)
    // every row computed before the cancel is a value row, none a "not computed" row of the cut answer
    expect(done?.rows.every((r) => r.values || r.reason === 'No fitted model parameters')).toBe(
      true,
    )
    expect(rows.at(-1)).toBeLessThan(30)
  })
})
