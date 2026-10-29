import { beforeEach, expect, it, vi } from 'vitest'

vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  ...(await import('./fake-hooks.ts')).fakeHooks,
}))
const reads = vi.hoisted(
  () => [] as { name: string; resolve: (v: unknown) => void; reject: (e: unknown) => void }[],
)
vi.mock('../src/lib/data-file.ts', () => ({
  dataFile: (name: string) =>
    new Promise((resolve, reject) => {
      reads.push({ name, resolve, reject })
    }),
}))

const { renderHook } = await import('./fake-hooks.ts')
const { useRead, useRecord } = await import('../src/components/use-record.ts')

/** Lets the settled promises of the reads run their handlers. */
const settle = () => new Promise((r) => setTimeout(r))
const read = (i: number) => {
  const r = reads[i]
  if (!r) throw new Error(`no read ${i}`)
  return r
}

beforeEach(() => {
  reads.length = 0
})

it('reads the record file once and shows it', async () => {
  const view = renderHook(() => useRecord<{ id: string }>('bullets', 'b1'))
  expect(view.result.state).toEqual({ status: 'loading' })
  expect(reads.map((r) => r.name)).toEqual(['bullets/b1'])
  read(0).resolve({ id: 'b1' })
  await settle()
  expect(view.rerender().state).toEqual({ status: 'ok', data: { id: 'b1' } })
  expect(reads).toHaveLength(1)
})

it('tells a missing file from a failed read, and Retry reads again', async () => {
  const view = renderHook(() => useRecord('bullets', 'b1'))
  read(0).resolve(undefined)
  await settle()
  expect(view.rerender().state).toEqual({ status: 'notFound' })
  view.rerender().retry()
  expect(view.rerender().state).toEqual({ status: 'loading' })
  expect(reads).toHaveLength(2)
  read(1).reject(new Error('offline'))
  await settle()
  expect(view.rerender().state).toEqual({ status: 'error' })
})

it('drops an answer that arrives after the page has gone', async () => {
  const view = renderHook(() => useRecord('bullets', 'b1'))
  view.unmount()
  read(0).resolve({ id: 'b1' })
  await settle()
  expect(view.rerender().state).toEqual({ status: 'loading' })
})

it('reads extras with a signal, aborts it when the page goes and keeps an aborted read quiet', async () => {
  const signals: AbortSignal[] = []
  let fail: (e: unknown) => void = () => {}
  const view = renderHook(() =>
    useRead((signal) => {
      signals.push(signal)
      return new Promise((_, reject) => {
        fail = reject
      })
    }),
  )
  view.unmount()
  expect(signals[0]?.aborted).toBe(true)
  fail(new Error('aborted'))
  await settle()
  expect(view.rerender().state).toEqual({ status: 'loading' })
})

it('shows a failed read of extras as an error until Retry reads again', async () => {
  let calls = 0
  const view = renderHook(() =>
    useRead(() => (++calls === 1 ? Promise.reject(new Error('offline')) : Promise.resolve(7))),
  )
  await settle()
  expect(view.rerender().state).toEqual({ status: 'error' })
  view.rerender().retry()
  view.rerender()
  await settle()
  expect(view.rerender().state).toEqual({ status: 'ok', data: 7 })
  expect(calls).toBe(2)
})
