'use client'

import { type ComponentProps, useMemo } from 'react'
import { formatNumber } from '../i18n/number.ts'
import { msg } from '../i18n/translate.ts'
import { type PowderRow, vivacityUnit } from '../lib/burn-rate.ts'
import { caliberOptions, commonCaliber } from '../lib/caliber.ts'
import { type CartridgeRow, cartridgeCells } from '../lib/cartridge-rows.ts'
import { baseText, caseTypeText, grainFormText } from '../lib/list-values.ts'
import type { PowderDesign } from '../lib/powder-designer.ts'
import {
  cartridgeKeys,
  fetchCartridgeCatalogue,
  fetchPowderCatalogue,
  powderKeys,
  rankRecords,
} from '../lib/record-choosers.ts'
import { userCartridgeRows } from '../lib/sources.ts'
import type { UserCartridgeView } from '../lib/variants.ts'
import {
  type ChooserKind,
  countedOptions,
  manufacturerSelect,
  RecordChooser,
} from './record-chooser.tsx'

/** The powders as a kind of the record chooser. */
export const powderKind: ChooserKind<PowderRow> = {
  texts: {
    title: msg('Choose a powder'),
    close: msg('Close the powder search'),
    search: msg('Search powders'),
    help: msg('Words of the manufacturer or name in any order'),
    column: msg('Powder'),
    list: msg('Powders'),
    preview: msg('Highlighted powder'),
    loading: msg('Loading powders'),
    all: msg('{total} powders'),
    some: msg('{found} of {total} powders'),
    cut: msg('{found} of {total} powders, first {shown} shown'),
    errorTitle: msg('The powders could not be read.'),
    errorText: msg(
      'The powder data could not be loaded. Check the connection and retry. The designer and the workbench still work.',
    ),
    empty: msg('No powder matches'),
  },
  load: fetchPowderCatalogue,
  selects: [
    manufacturerSelect(),
    {
      label: msg('Form'),
      nothingFound: msg('No form found'),
      options: (_, rows, t) =>
        countedOptions(
          rows,
          (r) => r.grainForm,
          (v) => grainFormText(t, v),
        ),
      keep: (r, v) => r.grainForm === v,
    },
    {
      label: msg('Base'),
      nothingFound: msg('No base found'),
      options: (_, rows, t) =>
        countedOptions(
          rows,
          (r) => r.propellantBase,
          (v) => baseText(t, v),
        ),
      keep: (r, v) => r.propellantBase === v,
    },
  ],
  sorts: [
    { value: 'relevance', label: msg('Best match') },
    { value: 'name', label: msg('Manufacturer and name') },
    { value: 'rate', label: msg('Fastest first') },
  ],
  search: (rows, query, sort) =>
    rankRecords(rows, query, powderKeys, sort, sort === 'rate' ? (r) => r.meanVivacity : undefined),
  columns: [
    {
      label: msg('Form'),
      width: '5rem',
      cell: (r, _, t) => (r.grainForm ? grainFormText(t, r.grainForm) : ''),
    },
    {
      label: msg('Base'),
      width: '4.5rem',
      cell: (r, _, t) => (r.propellantBase ? baseText(t, r.propellantBase) : ''),
    },
    {
      label: msg('Burn-rate order'),
      width: '7rem',
      cell: (r, _, t) => (r.burnRateOrder === undefined ? t('n/a') : String(r.burnRateOrder)),
    },
  ],
  facts: (row, _, t) => [
    [msg('Manufacturer'), row.manufacturerName || undefined],
    [msg('Form'), row.grainForm && grainFormText(t, row.grainForm)],
    [msg('Base'), row.propellantBase && baseText(t, row.propellantBase)],
    [
      msg('Burn-rate order'),
      row.burnRateOrder === undefined ? undefined : String(row.burnRateOrder),
    ],
    [
      msg('Mean vivacity'),
      row.meanVivacity === undefined
        ? undefined
        : `${formatNumber(row.meanVivacity, 2)} ${vivacityUnit}`,
    ],
  ],
  href: (row) => `/powders/${row.id}`,
}

/** The cartridges as a kind of the record chooser. */
export const cartridgeKind: ChooserKind<CartridgeRow> = {
  texts: {
    title: msg('Choose a cartridge'),
    close: msg('Close the cartridge search'),
    search: msg('Search cartridges'),
    help: msg('Words of the name or an alias in any order, such as 308 win or 6.5x55'),
    column: msg('Cartridge'),
    list: msg('Cartridges'),
    preview: msg('Highlighted cartridge'),
    loading: msg('Loading cartridges'),
    all: msg('{total} cartridges'),
    some: msg('{found} of {total} cartridges'),
    cut: msg('{found} of {total} cartridges, first {shown} shown'),
    errorTitle: msg('The cartridges could not be read.'),
    errorText: msg(
      'The cartridge data could not be loaded. Check the connection and retry. The designer and the workbench still work.',
    ),
    empty: msg('No cartridge matches'),
  },
  load: fetchCartridgeCatalogue,
  selects: [
    {
      label: msg('Caliber'),
      nothingFound: msg('No caliber found'),
      options: (_, rows, t) =>
        caliberOptions(
          rows.flatMap((r) => (r.maxBulletDiameter === undefined ? [] : [r.maxBulletDiameter])),
          t,
        ),
      keep: (r, v) => r.maxBulletDiameter !== undefined && commonCaliber(r.maxBulletDiameter) === v,
    },
    {
      label: msg('Case type'),
      nothingFound: msg('No case type found'),
      options: (_, rows, t) =>
        countedOptions(
          rows,
          (r) => r.caseType,
          (v) => caseTypeText(t, v),
        ),
      keep: (r, v) => r.caseType === v,
    },
  ],
  sorts: [
    { value: 'relevance', label: msg('Best match') },
    { value: 'name', label: msg('Name') },
    { value: 'caliber', label: msg('Largest caliber first') },
  ],
  search: (rows, query, sort) =>
    rankRecords(
      rows,
      query,
      cartridgeKeys,
      sort,
      sort === 'caliber' ? (r) => r.maxBulletDiameter : undefined,
    ),
  columns: [
    {
      label: msg('Caliber'),
      width: '4.5rem',
      cell: (r, system) => cartridgeCells(r, system).caliber,
    },
    {
      label: msg('Case type'),
      width: '6rem',
      cell: (r, _, t) => (r.caseType ? caseTypeText(t, r.caseType) : ''),
    },
    {
      label: msg('Pmax'),
      width: '6rem',
      cell: (r, system, t) =>
        r.pmax === undefined
          ? t('n/a')
          : `${cartridgeCells(r, system).pmax} ${system.pressure.symbol}`,
    },
  ],
  facts: (row, system, t) => {
    const cells = cartridgeCells(row, system)
    const length = (text: string) => text && `${text} ${system.length.symbol}`
    return [
      [msg('Caliber'), cells.caliber || undefined],
      [msg('Bullet diameter G1'), length(cells.maxBulletDiameter) || undefined],
      [msg('Case length L3'), length(cells.caseLength) || undefined],
      [msg('Max length L6'), length(cells.cartridgeLength) || undefined],
      [msg('Pmax'), cells.pmax ? `${cells.pmax} ${system.pressure.symbol}` : undefined],
      [msg('Case type'), row.caseType && caseTypeText(t, row.caseType)],
      [msg('Country'), row.country],
    ]
  },
  href: (row) => `/cartridges/${row.id}`,
}

export { BulletSearchDialog } from './bullet-search-dialog.tsx'

type ChooserProps<R extends PowderRow | CartridgeRow> = Omit<
  ComponentProps<typeof RecordChooser<R>>,
  'kind' | 'designs'
>

/** The Powder card's chooser dialog, the browser's powder designs listed with the catalogue. */
export function PowderChooser({
  designs,
  ...props
}: ChooserProps<PowderRow> & { designs: readonly PowderDesign[] }) {
  const rows = useMemo(
    () =>
      designs.map(
        (d): PowderRow => ({
          id: d.id,
          origin: 'user',
          manufacturer: '',
          manufacturerName: '',
          name: d.name,
          grainForm: d.powder.grainForm,
          propellantBase: d.powder.propellantBase,
        }),
      ),
    [designs],
  )
  return <RecordChooser kind={powderKind} designs={rows} {...props} />
}

/** The Cartridge card's chooser dialog, the browser's cartridge designs listed with the catalogue. */
export function CartridgeChooser({
  designs,
  ...props
}: ChooserProps<CartridgeRow> & { designs: readonly UserCartridgeView[] }) {
  const rows = useMemo(() => userCartridgeRows(designs), [designs])
  return <RecordChooser kind={cartridgeKind} designs={rows} {...props} />
}
