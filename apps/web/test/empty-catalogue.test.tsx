import { MantineProvider } from '@mantine/core'
import type { ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { NoPowders } from '../src/components/powder-list.tsx'
import { emptyListNote } from '../src/components/record-chooser.tsx'
import { cartridgeKind, powderKind } from '../src/components/record-choosers.tsx'
import { NoCataloguePowders } from '../src/components/workbench-inputs.tsx'
import { english } from '../src/i18n/translate.ts'

const { t } = english
const html = (node: ReactNode) => renderToStaticMarkup(<MantineProvider>{node}</MantineProvider>)

it('says in the powder list that the catalogue has no powders, with New powder and Import', () => {
  const list = html(<NoPowders />)
  expect(list).toContain('No powders yet')
  expect(list).toContain('import a table of your powders with Import')
  expect(list).toContain('href="/powders/designer"')
})

it('says in the workbench where a powder comes from when the catalogue has none', () => {
  expect(html(<NoCataloguePowders />)).toContain(
    'The catalogue has no powders. Choose one of your powder designs',
  )
})

it('gives the powder chooser a note for no powder at all, and keeps the empty-search note otherwise', () => {
  const none = emptyListNote(powderKind.texts, true)
  expect(t(none.title)).toBe('The catalogue has no powders.')
  expect(t(none.text)).toContain('powder designer')
  const noMatch = { title: powderKind.texts.empty, text: 'Remove a filter or a word.' }
  expect(emptyListNote(powderKind.texts, false)).toEqual(noMatch)
  // a kind without a note of its own keeps the empty-search note
  expect(emptyListNote(cartridgeKind.texts, true).title).toBe(cartridgeKind.texts.empty)
})
