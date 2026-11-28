import { useLingui } from '@lingui/react'
import { Button } from '@mantine/core'
import { Plus } from 'lucide-react'
import { useDeferredValue, useMemo } from 'react'
import Link from '@/platform/link.tsx'
import { loadEnglish } from '../i18n/lingui.ts'
import {
  type CartridgeRow,
  cartridgeCells,
  cartridgeMatches,
  cartridgeRank,
  cartridgeSearchText,
  compareCartridgeNames,
  noValues,
  type PackedCartridge,
  unpackCartridges,
} from '../lib/cartridge-rows.ts'
import { listTitles } from '../lib/list-titles.ts'
import { caseTypeText } from '../lib/list-values.ts'
import { filterText, matchingText } from '../lib/lists.ts'
import {
  countOrigins,
  designerHref,
  inOrigins,
  onlyText,
  originNames,
  readOrigins,
  userCartridgeRows,
} from '../lib/sources.ts'
import { userCartridges } from '../lib/variants.ts'
import englishMessages from '../locales/en/components/cartridge-list.json' with { type: 'json' }
import { DirectoryPage } from './directory-page.tsx'
import { type DirectoryColumn, DirectoryTable, useListState } from './directory-table.tsx'
import { DeleteRow, sourceColumn, useResolved, useUserRecords } from './list-sources.tsx'
import { GapBadge } from './standard-badge.tsx'
import { EmptyList } from './states.tsx'
import { UnitsIconButton, useUnits } from './units-settings.tsx'

loadEnglish(englishMessages)

/** The cartridge directory: page bar with the count, search row, windowed table. */
export function CartridgeList({ packed }: { packed: PackedCartridge[] }) {
  const { i18n } = useLingui()
  const [records, removeRow] = useUserRecords()
  const mine = useResolved(records, userCartridges)
  // the browser's designs first: a few rows would sit unseen behind the catalogue rows
  const items = useMemo(
    () => [
      ...userCartridgeRows(mine),
      ...unpackCartridges(packed).toSorted((a, b) => compareCartridgeNames(a.name, b.name)),
    ],
    [mine, packed],
  )
  const counts = useMemo(() => countOrigins(items), [items])
  const { system } = useUnits()
  const [state, set, clear] = useListState()
  const filters = useDeferredValue(state)
  const texts = useMemo(() => items.map(cartridgeSearchText), [items])
  const shown = useMemo(() => {
    const found = items.filter(
      (c, i) => inOrigins(c, filters.sources) && cartridgeMatches(c, filters.query, texts[i]),
    )
    // a search ranks the typed name first; a header sort replaces that order
    return filters.query.trim() === '' || filters.sort
      ? found
      : found.toSorted(
          (a, b) =>
            cartridgeRank(b, filters.query) - cartridgeRank(a, filters.query) ||
            compareCartridgeNames(a.name, b.name),
        )
  }, [items, texts, filters])
  const cells = useMemo(
    () => new Map(items.map((c) => [c.id, cartridgeCells(c, system)])),
    [items, system],
  )
  const cell = (c: CartridgeRow) => cells.get(c.id) ?? cartridgeCells(c, system)

  const on = readOrigins(state.sources)
  const named = [onlyText(i18n, on), matchingText(i18n, state.query)].filter(Boolean)
  const lengthUnit = system.length.symbol
  const pressureUnit = system.pressure.symbol
  const columns: DirectoryColumn<CartridgeRow>[] = [
    {
      key: 'name',
      label: /*i18n*/ { id: 'cartridges.column.name', message: 'Name' },
      value: (c) => c.name,
      compare: (a, b) => compareCartridgeNames(a.name, b.name),
      cell: (c) => (
        <>
          {c.name}
          {c.aliases.length > 0 && <span className="aliases"> {c.aliases.join(', ')}</span>}
          {noValues(c) && (
            <>
              {' '}
              <GapBadge />
            </>
          )}
        </>
      ),
    },
    {
      key: 'cal',
      label: /*i18n*/ { id: 'cartridges.column.cal', message: 'Caliber' },
      unit: 'in, mm',
      help: /*i18n*/ {
        id: 'cartridges.column.calHelp',
        message: 'The common caliber of the bullet diameter G1.',
      },
      width: '5rem',
      value: (c) => c.maxBulletDiameter,
      cell: (c) => cell(c).caliber,
    },
    {
      key: 'type',
      label: /*i18n*/ { id: 'cartridges.column.type', message: 'Case type' },
      width: '6.5rem',
      value: (c) => c.caseType,
      cell: (c) => (c.caseType ? caseTypeText(i18n, c.caseType) : ''),
    },
    {
      key: 'maxBulletDiameter',
      label: /*i18n*/ { id: 'cartridges.column.maxBulletDiameter', message: 'Bullet diameter G1' },
      unit: lengthUnit,
      help: /*i18n*/ {
        id: 'cartridges.column.maxBulletDiameterHelp',
        message: 'Cartridge value of the CIP sheet, smallest variant.',
      },
      num: true,
      width: '8.5rem',
      value: (c) => c.maxBulletDiameter,
      cell: (c) => cell(c).maxBulletDiameter,
    },
    {
      key: 'caseLength',
      label: /*i18n*/ { id: 'cartridges.column.caseLength', message: 'Case length L3' },
      unit: lengthUnit,
      help: /*i18n*/ {
        id: 'cartridges.column.caseLengthHelp',
        message: 'Cartridge maximum of the CIP sheet, shortest variant.',
      },
      num: true,
      width: '7.5rem',
      value: (c) => c.caseLength,
      cell: (c) => cell(c).caseLength,
    },
    {
      key: 'cartridgeLength',
      label: /*i18n*/ { id: 'cartridges.column.cartridgeLength', message: 'Max length L6' },
      unit: lengthUnit,
      help: /*i18n*/ {
        id: 'cartridges.column.cartridgeLengthHelp',
        message: 'COAL, the cartridge maximum of the CIP sheet, shortest variant.',
      },
      num: true,
      width: '7rem',
      value: (c) => c.cartridgeLength,
      cell: (c) => cell(c).cartridgeLength,
    },
    {
      key: 'pmax',
      label: /*i18n*/ { id: 'cartridges.column.pmax', message: 'Pmax' },
      unit: pressureUnit,
      help: /*i18n*/ {
        id: 'cartridges.column.pmaxHelp',
        message: "Maximum mean pressure of the CIP sheet, highest variant, by the sheet's method.",
      },
      num: true,
      width: '5.5rem',
      value: (c) => c.pmax,
      cell: (c) => cell(c).pmax,
    },
    // the column of the browser's own rows, while there are any
    ...(counts.user > 0 ? [sourceColumn((c: CartridgeRow) => c.name, removeRow)] : []),
  ]
  const facts = (c: CartridgeRow) => {
    const v = cell(c)
    return [
      c.origin === 'user' && i18n._(originNames.user),
      v.caliber,
      v.caseLength && `L3 ${v.caseLength} ${lengthUnit}`,
      v.cartridgeLength && `L6 ${v.cartridgeLength} ${lengthUnit}`,
      v.pmax && `${v.pmax} ${pressureUnit}`,
      c.caseType && caseTypeText(i18n, c.caseType),
    ]
      .filter(Boolean)
      .join(' · ')
  }
  return (
    <DirectoryPage
      title={listTitles.cartridges}
      noun="cartridges"
      shown={shown.length}
      total={items.length}
      actions={
        <>
          <Button
            component={Link}
            href="/cartridges/designer"
            leftSection={<Plus aria-hidden="true" />}
          >
            {i18n._({ id: 'cartridges.new', message: 'New cartridge' })}
          </Button>
          <UnitsIconButton />
        </>
      }
      state={state}
      set={set}
      placeholder={i18n._({
        id: 'cartridges.search',
        message: 'Name or alias, 308, 7,62 or .308…',
      })}
      columns={columns}
      counts={counts}
      table={
        <DirectoryTable
          rows={shown}
          columns={columns}
          link="name"
          href={(c) =>
            c.origin === 'user' ? designerHref('cartridges', c.id) : `/cartridges/${c.id}`
          }
          facts={facts}
          phoneAction={(c, tabIndex) =>
            c.origin === 'user' ? (
              <DeleteRow row={c} name={c.name} onDelete={removeRow} tabIndex={tabIndex} />
            ) : null
          }
          breakBefore={state.sort ? undefined : (c, previous) => c.origin !== previous.origin}
          label={(c) => c.name}
          caption={
            named.length === 0
              ? i18n._({ id: 'cartridges.all', message: 'All cartridges' })
              : i18n._({
                  id: 'cartridges.filtered',
                  message: 'Cartridges, {filters}',
                  values: { filters: named.join(', ') },
                })
          }
          noun="cartridges"
          sort={state.sort}
          onSort={(sort) => set({ sort })}
          empty={<EmptyList noun="cartridges" filters={filterText(named)} onClear={clear} />}
        />
      }
    />
  )
}
