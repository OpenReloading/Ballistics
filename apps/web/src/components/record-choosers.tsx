'use client'

import Link from 'next/link'
import { type ComponentProps, useMemo } from 'react'
import { useTranslation } from '../i18n/language.ts'
import { formatNumber } from '../i18n/number.ts'
import { msg, type Translator } from '../i18n/translate.ts'
import { type PowderRow, vivacityUnit } from '../lib/burn-rate.ts'
import { caliberOptions, commonCaliber } from '../lib/caliber.ts'
import { type CartridgeRow, cartridgeCells } from '../lib/cartridge-rows.ts'
import { powderRowIncomplete } from '../lib/complete-records.ts'
import { countryName, parseCountries } from '../lib/countries.ts'
import type { FirearmRow } from '../lib/firearm.ts'
import { baseText, caseTypeText, grainFormText, kebabValue } from '../lib/list-values.ts'
import type { PowderDesign } from '../lib/powder-designer.ts'
import type { PrimerRow } from '../lib/primer-rows.ts'
import {
  type CaseRow,
  cartridgeKeys,
  caseKeys,
  fetchCartridgeCatalogue,
  fetchPowderCatalogue,
  fetchPrimerCatalogue,
  firearmKeys,
  powderKeys,
  primerKeys,
  rankRecords,
} from '../lib/record-choosers.ts'
import { userCartridgeRows } from '../lib/sources.ts'
import { type UnitSystem, withUnit } from '../lib/units.ts'
import type { UserCartridgeView } from '../lib/variants.ts'
import {
  type ChooserKind,
  type ChooserRow,
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
  incomplete: powderRowIncomplete,
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
      [
        msg('Country'),
        row.country &&
          parseCountries(row.country)
            .map(({ name, code }) => countryName(name, code))
            .join(', '),
      ],
    ]
  },
  href: (row) => `/cartridges/${row.id}`,
}

/** The value `si` in the unit of `q`, empty without one. */
const quantity = (q: 'barrelLength' | 'twist', system: UnitSystem, si: number | undefined) =>
  si === undefined ? '' : withUnit(q, system, si)

const byName = [
  { value: 'relevance', label: msg('Best match') },
  { value: 'name', label: msg('Name') },
]

/** The firearms of the Gun card as a kind of the record chooser: the library and the example rifle. */
export const firearmKind: ChooserKind<FirearmRow> = {
  texts: {
    title: msg('Choose a firearm'),
    close: msg('Close the firearm search'),
    search: msg('Search firearms'),
    help: msg('Words of the name in any order'),
    column: msg('Firearm'),
    list: msg('Firearms'),
    preview: msg('Highlighted firearm'),
    loading: msg('Loading firearms'),
    all: msg('{total} firearms'),
    some: msg('{found} of {total} firearms'),
    cut: msg('{found} of {total} firearms, first {shown} shown'),
    errorTitle: msg('The firearms could not be read.'),
    errorText: msg('The firearm library could not be read. Retry, or reload the page.'),
    empty: msg('No firearm matches'),
  },
  selects: [],
  sorts: byName,
  search: (rows, query, sort) => rankRecords(rows, query, firearmKeys, sort),
  columns: [
    {
      label: msg('Barrel length'),
      width: '7rem',
      cell: (r, system) => quantity('barrelLength', system, r.barrelLength),
    },
    { label: msg('Twist'), width: '6rem', cell: (r, system) => quantity('twist', system, r.twist) },
  ],
  facts: (row, system) => [
    [msg('Barrel length'), quantity('barrelLength', system, row.barrelLength) || undefined],
    [msg('Twist'), quantity('twist', system, row.twist) || undefined],
  ],
}

const water = (grams: number | undefined, t: Translator['t']) =>
  grams === undefined ? '' : t('{grams} g water', { grams: formatNumber(grams, 2) })

/** The brass of the cartridge as a kind of the record chooser: the user's case groups and the case records. */
export const caseKind: ChooserKind<CaseRow> = {
  texts: {
    title: msg('Choose the brass'),
    close: msg('Close the brass search'),
    search: msg('Search brass'),
    help: msg('Words of the manufacturer or name in any order'),
    column: msg('Brass'),
    list: msg('Brass'),
    preview: msg('Highlighted brass'),
    loading: msg('Loading brass'),
    all: msg('{total} brass records'),
    some: msg('{found} of {total} brass records'),
    cut: msg('{found} of {total} brass records, first {shown} shown'),
    errorTitle: msg('The brass could not be read.'),
    errorText: msg('The case records could not be loaded. Check the connection and retry.'),
    empty: msg('No brass matches'),
  },
  selects: [],
  sorts: [
    { value: 'relevance', label: msg('Best match') },
    { value: 'name', label: msg('Manufacturer and name') },
  ],
  search: (rows, query, sort) => rankRecords(rows, query, caseKeys, sort),
  columns: [
    {
      label: msg('Material'),
      width: '6rem',
      cell: (r, _, t) => (r.material ? kebabValue(t, r.material) : ''),
    },
    { label: msg('Water'), width: '7rem', cell: (r, _, t) => water(r.waterCapacity, t) },
  ],
  facts: (row, _, t) => [
    [msg('Manufacturer'), row.manufacturerName || undefined],
    [msg('Material'), row.material && kebabValue(t, row.material)],
    [msg('Water'), water(row.waterCapacity, t) || undefined],
  ],
  href: (row) => (row.id.startsWith('user:') ? undefined : `/cases/${row.id}`),
}

const yesNo = (v: boolean | undefined, t: Translator['t']) =>
  v === undefined ? undefined : v ? t('Yes') : t('No')

/** The primers as a kind of the record chooser. */
export const primerKind: ChooserKind<PrimerRow> = {
  texts: {
    title: msg('Choose a primer'),
    close: msg('Close the primer search'),
    search: msg('Search primers'),
    help: msg('Words of the manufacturer or name in any order'),
    column: msg('Primer'),
    list: msg('Primers'),
    preview: msg('Highlighted primer'),
    loading: msg('Loading primers'),
    all: msg('{total} primers'),
    some: msg('{found} of {total} primers'),
    cut: msg('{found} of {total} primers, first {shown} shown'),
    errorTitle: msg('The primers could not be read.'),
    errorText: msg(
      'The primer data could not be loaded. Check the connection and retry. The workbench still works.',
    ),
    empty: msg('No primer matches'),
  },
  load: fetchPrimerCatalogue,
  selects: [
    manufacturerSelect(),
    {
      label: msg('Size'),
      nothingFound: msg('No size found'),
      options: (catalogue, _, t) =>
        countedOptions(
          catalogue,
          (r) => r.size,
          (v) => kebabValue(t, v),
        ),
      keep: (r, v) => r.size === v,
    },
  ],
  sorts: [
    { value: 'relevance', label: msg('Best match') },
    { value: 'name', label: msg('Manufacturer and name') },
  ],
  search: (rows, query, sort) => rankRecords(rows, query, primerKeys, sort),
  columns: [
    { label: msg('Size'), width: '8rem', cell: (r, _, t) => kebabValue(t, r.size) },
    { label: msg('Magnum'), width: '5rem', cell: (r, _, t) => yesNo(r.magnum, t) ?? '' },
  ],
  facts: (row, _, t) => [
    [msg('Manufacturer'), row.manufacturerName || undefined],
    [msg('Product number'), row.productNumber],
    [msg('Size'), kebabValue(t, row.size)],
    [msg('Magnum'), yesNo(row.magnum, t)],
    [msg('Compound'), row.compound && kebabValue(t, row.compound)],
  ],
  href: (row) => `/primers/${row.id}`,
}

export { BulletSearchDialog } from './bullet-search-dialog.tsx'

type ChooserProps<R extends ChooserRow> = Omit<
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
          ...(d.powder.interior && { modelled: true as const }),
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

const none: readonly never[] = []

/** The Gun card's chooser dialog over `catalogue`, with a link to add a firearm while the library is empty (`add`). */
export function FirearmChooser({ add, ...props }: ChooserProps<FirearmRow> & { add: boolean }) {
  const { t } = useTranslation()
  return (
    <RecordChooser
      kind={firearmKind}
      designs={none}
      chips={
        add && (
          <Link href="/firearms" target="_blank" rel="noopener">
            {t('Add a firearm under Firearms')}
            <span className="visually-hidden"> {t('in a new tab')}</span>
          </Link>
        )
      }
      {...props}
    />
  )
}

/** The brass chooser dialog over `catalogue`, the cartridge's brass. */
export function CaseChooser(props: ChooserProps<CaseRow>) {
  return <RecordChooser kind={caseKind} designs={none} {...props} />
}

/** The primer chooser dialog over the catalogue's primers. */
export function PrimerChooser(props: ChooserProps<PrimerRow>) {
  return <RecordChooser kind={primerKind} designs={none} {...props} />
}
