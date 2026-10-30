'use client'

import { NumberInput, Pill } from '@mantine/core'
import type { CartridgeDiameters } from '@open-reloading/core'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from '../i18n/language.ts'
import { msg } from '../i18n/translate.ts'
import {
  type BulletRow,
  ballisticCoefficientText,
  bulletBallisticCoefficient,
  bulletCells,
} from '../lib/bullet-rows.ts'
import { type BulletSort, fetchBulletCatalogue, searchBullets } from '../lib/bullet-search.ts'
import { caliberOptions, commonCaliber } from '../lib/caliber.ts'
import { manufacturerOptions } from '../lib/manufacturers.ts'
import type { UnitSystem } from '../lib/units.ts'
import { type ChooserKind, RecordChooser } from './record-chooser.tsx'

/** The manufacturer options, each with its number of bullets. */
function manufacturerChoices(catalogue: readonly BulletRow[]) {
  const counts = new Map<string, number>()
  for (const r of catalogue)
    if (r.manufacturer) counts.set(r.manufacturer, (counts.get(r.manufacturer) ?? 0) + 1)
  return manufacturerOptions(catalogue).map((o) => ({
    ...o,
    label: `${o.label} (${counts.get(o.value)})`,
  }))
}

/** The bullets as a kind of the record chooser; `search` without the mass and fit filters. */
export const bulletKind: ChooserKind<BulletRow> = {
  texts: {
    title: msg('Choose a bullet'),
    close: msg('Close the bullet search'),
    search: msg('Search bullets'),
    help: msg(
      'Words of the manufacturer or name in any order, a caliber such as 308, a weight such as 168 or 10.9g',
    ),
    column: msg('Bullet'),
    list: msg('Bullets'),
    preview: msg('Highlighted bullet'),
    loading: msg('Loading bullets'),
    all: msg('{total} bullets'),
    some: msg('{found} of {total} bullets'),
    cut: msg('{found} of {total} bullets, first {shown} shown'),
    errorTitle: msg('The bullets could not be read.'),
    errorText: msg(
      'The bullet data could not be loaded. Check the connection and retry. The designer and the workbench still work.',
    ),
    empty: msg('No bullet matches'),
  },
  load: fetchBulletCatalogue,
  selects: [
    {
      label: msg('Manufacturer'),
      nothingFound: msg('No manufacturer found'),
      options: (catalogue) => manufacturerChoices(catalogue),
      keep: (r, v) => r.manufacturer === v,
    },
    {
      label: msg('Caliber'),
      nothingFound: msg('No caliber found'),
      options: (_, rows, t) =>
        caliberOptions(
          rows.map((r) => r.diameter),
          t,
        ),
      keep: (r, v) => commonCaliber(r.diameter) === v,
    },
  ],
  sorts: [
    { value: 'relevance', label: msg('Best match') },
    { value: 'name', label: msg('Manufacturer and name') },
    { value: 'mass', label: msg('Heaviest first') },
    { value: 'ballisticCoefficient', label: msg('Highest BC first') },
  ],
  search: (rows, query, sort) =>
    searchBullets(rows, query, { manufacturer: '', caliber: '', mass: '' }, sort as BulletSort),
  columns: [
    { label: msg('Caliber'), width: '4.5rem', cell: (r) => commonCaliber(r.diameter) },
    {
      label: msg('Mass'),
      width: '5rem',
      cell: (r, system, t) =>
        r.mass === null ? t('n/a') : `${bulletCells(r, system).mass} ${system.mass.symbol}`,
    },
    {
      label: msg('BC'),
      width: '5.5rem',
      cell: (r, _, t) => {
        const bc = bulletBallisticCoefficient(r)
        return bc ? ballisticCoefficientText(bc) : t('n/a')
      },
    },
  ],
  facts: (row, system) => {
    const cells = bulletCells(row, system)
    const bc = bulletBallisticCoefficient(row)
    return [
      [msg('Manufacturer'), row.manufacturerName || undefined],
      [msg('Caliber'), cells.caliber],
      [msg('Diameter'), cells.diameter],
      [msg('Mass'), row.mass === null ? undefined : `${cells.mass} ${system.mass.symbol}`],
      [msg('Length'), row.length === null ? undefined : `${cells.length} ${system.length.symbol}`],
      [
        msg('BC'),
        bc
          ? [bc, bc.other].flatMap((x) => (x ? [ballisticCoefficientText(x)] : [])).join(', ')
          : undefined,
      ],
      [msg('Construction'), row.construction],
      [msg('Tip'), row.tipType],
      [msg('Country'), row.country],
    ]
  },
  href: (row) => `/bullets/${row.id}`,
}

/**
 * The bullet picker of a workbench card: the record chooser over the whole catalogue and the
 * browser's own designs (several words in any order, a caliber such as 308, a weight such as 168
 * or 10.9g), with a mass range and `fit`, which keeps the bullets that fit the cartridge until its
 * chip is removed.
 */
export function BulletSearchDialog({
  opened,
  onClose,
  text,
  designs,
  fit,
  fitName,
  system,
  onChoose,
}: {
  opened: boolean
  onClose: () => void
  /** What the card's field held when the dialog was opened. */
  text: string
  /** The browser's bullet designs as rows (`userBulletRows`). */
  designs: readonly BulletRow[]
  fit?: CartridgeDiameters | undefined
  fitName?: string | undefined
  system: UnitSystem
  onChoose: (row: BulletRow) => void
}) {
  const { t } = useTranslation()
  const [from, setFrom] = useState<string | number>('')
  const [to, setTo] = useState<string | number>('')
  const [fitOn, setFitOn] = useState(true)

  // each opening starts from the cartridge fit and no mass range
  useEffect(() => {
    if (!opened) return
    setFrom('')
    setTo('')
    setFitOn(true)
  }, [opened])

  const massUnit = system.mass.symbol === 'gr' ? 'gr' : 'g'
  const mass = from === '' && to === '' ? '' : `${from}-${to}${massUnit}`
  const kind = useMemo<ChooserKind<BulletRow>>(
    () => ({
      ...bulletKind,
      search: (rows, query, sort) =>
        searchBullets(
          rows,
          query,
          { manufacturer: '', caliber: '', mass, fit: fitOn ? fit : undefined },
          sort as BulletSort,
        ),
    }),
    [mass, fitOn, fit],
  )
  return (
    <RecordChooser
      kind={kind}
      opened={opened}
      onClose={onClose}
      text={text}
      designs={designs}
      system={system}
      onChoose={onChoose}
      count={mass ? 1 : 0}
      filters={
        <fieldset className="bd-mass">
          <legend>{t('Mass ({unit})', { unit: system.mass.symbol })}</legend>
          <NumberInput
            aria-label={t('Mass from, {unit}', { unit: system.mass.symbol })}
            placeholder={t('From')}
            min={0}
            hideControls
            value={from}
            onChange={setFrom}
          />
          <NumberInput
            aria-label={t('Mass to, {unit}', { unit: system.mass.symbol })}
            placeholder={t('To')}
            min={0}
            hideControls
            value={to}
            onChange={setTo}
          />
        </fieldset>
      }
      chips={
        fit &&
        fitOn && (
          <div className="bd-chips">
            <Pill
              withRemoveButton
              onRemove={() => setFitOn(false)}
              removeButtonProps={{ 'aria-label': t('Show bullets of every diameter') }}
            >
              {fitName ? t('Fits {name}', { name: fitName }) : t('Fits the cartridge')}
            </Pill>
          </div>
        )
      }
    />
  )
}
