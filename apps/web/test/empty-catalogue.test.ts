import { buildCatalogue, type CatalogueIndex } from '@open-reloading/api/catalogue'
import { expect, it, vi } from 'vitest'

vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  ...(await import('./fake-hooks.ts')).fakeHooks,
}))
const files = vi.hoisted(() => ({ index: undefined as unknown, reads: 0 }))
vi.mock('../src/lib/data-file.ts', () => ({
  dataFile: async () => {
    files.reads++
    return files.index
  },
}))

const { renderHook } = await import('./fake-hooks.ts')
const { useNoCataloguePowders } = await import('../src/components/workbench-inputs.tsx')
const { emptyListNote } = await import('../src/components/record-chooser.tsx')
const { cartridgeKind, powderKind } = await import('../src/components/record-choosers.tsx')
const { english } = await import('../src/i18n/translate.ts')

const empty: CatalogueIndex = buildCatalogue({
  cartridges: [],
  manufacturers: [],
  powders: [],
  primers: [],
  bullets: [],
  cases: [],
  capacities: [],
  targetFaces: [],
  federations: [],
  disciplines: [],
  targetMappings: [],
  caliberClasses: [],
}).index
const withPowder: CatalogueIndex = {
  ...empty,
  powders: [{ item: { id: 'p1', manufacturer: 'm1', name: 'P1' }, sortKey: 'p1', search: 'p1' }],
}

it('asks the static API whether the catalogue has a powder, for the workbench note', async () => {
  files.index = empty
  const none = renderHook(() => useNoCataloguePowders())
  await vi.waitFor(() => expect(none.rerender()).toBe(true))
  files.index = withPowder
  const reads = files.reads
  const some = renderHook(() => useNoCataloguePowders())
  await vi.waitFor(() => expect(files.reads).toBeGreaterThan(reads))
  await new Promise((r) => setTimeout(r, 20))
  expect(some.rerender()).toBe(false)
})

it('gives the powder chooser a note for no powder at all, and keeps the empty-search note otherwise', () => {
  const { t } = english
  const none = emptyListNote(powderKind.texts, true)
  expect(t(none.title)).toBe('The catalogue has no powders.')
  expect(t(none.text)).toContain('powder designer')
  const noMatch = { title: powderKind.texts.empty, text: 'Remove a filter or a word.' }
  expect(emptyListNote(powderKind.texts, false)).toEqual(noMatch)
  // a kind without a note of its own keeps the empty-search note
  expect(emptyListNote(cartridgeKind.texts, true).title).toBe(cartridgeKind.texts.empty)
})
