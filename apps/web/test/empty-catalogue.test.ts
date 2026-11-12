import { buildCatalogue, type CatalogueIndex } from '@rangefoundry/use-cases/catalog'
import { expect, it, vi } from 'vitest'

vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  ...(await import('./fake-hooks.ts')).fakeHooks,
}))
const files = vi.hoisted(() => ({ index: undefined as unknown }))
vi.mock('../src/lib/data-file.ts', () => ({ dataFile: async () => files.index }))

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

it('asks the static API for the powders of the catalogue and tells when it has none, for the workbench note', async () => {
  files.index = empty
  const none = renderHook(() => useNoCataloguePowders())
  await vi.waitFor(() => expect(none.rerender()).toBe(true))
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
