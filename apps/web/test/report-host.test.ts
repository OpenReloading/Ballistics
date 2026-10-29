import type { TargetSheet } from '@open-reloading/schema'
import { afterEach, expect, it, vi } from 'vitest'

vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  ...(await import('./fake-hooks.ts')).fakeHooks,
}))
vi.mock('../src/i18n/language.ts', async () => {
  const { english } = await import('../src/i18n/translate.ts')
  return { useTranslation: () => english }
})
vi.mock('../src/lib/face-records.ts', () => ({
  fetchFederationData: () => Promise.reject(new Error('offline')),
}))

const { renderHook } = await import('./fake-hooks.ts')
const { reportHost, useReportOptions, useSheetReport } = await import(
  '../src/components/report-host.ts'
)

afterEach(() => {
  reportHost.options = undefined
})

const option = (label: string) => ({ label, heading: label, text: () => label })

it('offers the options while the page is mounted, always the latest ones', () => {
  let options = [option('a')]
  const view = renderHook(() => useReportOptions(options))
  expect(reportHost.options?.().map((o) => o.label)).toEqual(['a'])
  options = [option('b')]
  view.rerender()
  expect(reportHost.options?.().map((o) => o.label)).toEqual(['b'])
  view.unmount()
  expect(reportHost.options).toBeUndefined()
})

it('offers nothing without options, and withdraws them when they go', () => {
  let options: ReturnType<typeof option>[] | undefined
  const view = renderHook(() => useReportOptions(options))
  expect(reportHost.options).toBeUndefined()
  options = [option('a')]
  view.rerender()
  expect(reportHost.options).toBeDefined()
  options = undefined
  view.rerender()
  expect(reportHost.options).toBeUndefined()
})

it('leaves the options of a page mounted later in place when an earlier one goes', () => {
  const first = renderHook(() => useReportOptions([option('first')]))
  const later = () => [option('later')]
  reportHost.options = later
  first.unmount()
  expect(reportHost.options).toBe(later)
})

it('offers the sheet settings, then the shot positions behind them, and nothing without a sheet', async () => {
  renderHook(() => useSheetReport(undefined))
  expect(reportHost.options).toBeUndefined()
  const sheet = { groups: [] } as unknown as Pick<TargetSheet, 'groups'>
  renderHook(() => useSheetReport(sheet))
  const [settings, shots] = reportHost.options?.() ?? []
  expect(settings?.label).toBe('Include the sheet settings (no photo)')
  expect(shots?.needs).toBe(settings?.label)
  // the federation names are left out when they cannot be read
  await expect(Promise.resolve(settings?.text())).resolves.toBeTypeOf('string')
  expect(shots?.text()).toBeTypeOf('string')
})
