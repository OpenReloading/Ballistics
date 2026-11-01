'use client'

import {
  Button,
  CloseButton,
  Flex,
  Table,
  TableTbody,
  TableTd,
  TableTh,
  TableThead,
  TableTr,
  Text,
} from '@mantine/core'
import type { Bullet } from '@open-reloading/schema'
import { Flask, Plus } from '@phosphor-icons/react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { type CSSProperties, type ReactNode, useState } from 'react'
import { useTranslation } from '../i18n/language.ts'
import { msg } from '../i18n/translate.ts'
import {
  compareGroups,
  differenceMarks,
  differenceToFirst,
  rowDiffers,
  turnPrefixOf,
} from '../lib/bullet-compare.ts'
import { caliberLabel, caliberUnit } from '../lib/caliber.ts'
import { compareHref, maxComparedBullets } from '../lib/compare-ids.ts'
import { productLabel } from '../lib/manufacturers.ts'
import { nth } from '../lib/nth.ts'
import { workbenchHref } from '../lib/query.ts'
import { controlSize } from '../lib/theme.ts'
import { say } from '../lib/wording.ts'
import { bulletKind } from './bullet-search-dialog.tsx'
import { Panel } from './panel.tsx'
import { RecordChooser } from './record-chooser.tsx'
import { ScrollRegion } from './scroll-region.tsx'
import { useUnits } from './units-settings.tsx'

const markText = { max: msg('largest'), min: msg('smallest') } as const

/** "Add bullet": the bullet search over the catalogue; the chosen bullet joins the comparison as its last column. */
function AddBullet({ ids }: { ids: string[] }) {
  const { t } = useTranslation()
  const { system } = useUnits()
  const router = useRouter()
  const [opened, setOpened] = useState(false)
  if (ids.length >= maxComparedBullets) return null
  return (
    <>
      <Button
        variant="default"
        size={controlSize.row.button}
        leftSection={<Plus aria-hidden="true" />}
        className="screen-only"
        onClick={() => setOpened(true)}
      >
        {t('Add bullet')}
      </Button>
      <RecordChooser
        kind={bulletKind}
        opened={opened}
        onClose={() => setOpened(false)}
        text=""
        designs={[]}
        system={system}
        onChoose={(row) => {
          setOpened(false)
          if (!ids.includes(row.id)) router.push(compareHref([...ids, row.id]))
        }}
      />
    </>
  )
}

/**
 * Bullets as columns: the bullet data in the groups of the bullet record (symbol, quantity, a value
 * per bullet, unit), the key values first; the head of each column the name, caliber, Use in
 * workbench and a remove button, Add bullet up to 4. A row whose values differ is tinted, the
 * largest and smallest of a numeric row marked, each value after the first with its difference to
 * the first bullet's, "n/a" where a record has no value. Then the drawings at one scale in one
 * panel. On a phone the tables scroll sideways inside their panels. The page's mm or in switch
 * (`RecordScope`, in the page bar) sets the drawings and the table.
 */
export function BulletCompare({
  bullets,
  drawings,
}: {
  bullets: (Bullet & { manufacturerName: string })[]
  drawings: ReactNode[]
}) {
  const { system } = useUnits()
  const { t } = useTranslation()
  const ids = bullets.map((b) => b.id)
  const style = { '--n': bullets.length } as CSSProperties
  return (
    <div className="bullet-compare" style={style}>
      <Panel
        id="compare-data"
        title={msg('Bullet data')}
        translated
        controls={<AddBullet ids={ids} />}
      >
        <ScrollRegion label={t('Bullet data table')}>
          <Table className="field-table symbol-table compare-table" aria-labelledby="compare-data">
            <TableThead>
              <TableTr>
                <TableTh scope="col" className="field-symbol">
                  {t('Symbol')}
                </TableTh>
                <TableTh scope="col">{t('Quantity')}</TableTh>
                {bullets.map((b) => (
                  <TableTh key={b.id} scope="col">
                    <Flex align="flex-start" justify="space-between" gap={4}>
                      <span className="compare-name">
                        <Text component="span" inherit c="dimmed" fz="xs" fw={400}>
                          {b.manufacturerName}
                        </Text>
                        <Link href={`/bullets/${b.id}`}>{b.name}</Link>
                        {b.diameter && (
                          <Text component="span" inherit c="dimmed" fz="xs" fw={400}>
                            {caliberLabel(b.diameter.value, caliberUnit(system))}
                          </Text>
                        )}
                        <Link
                          href={workbenchHref('bullet', b.id)}
                          className="compare-workbench screen-only"
                          aria-label={t('Use {name} in workbench', { name: productLabel(b) })}
                        >
                          <Flask aria-hidden="true" />
                          {t('Use in workbench')}
                        </Link>
                      </span>
                      {bullets.length > 1 && (
                        <CloseButton
                          component={Link}
                          href={compareHref(ids.filter((id) => id !== b.id))}
                          className="screen-only"
                          aria-label={t('Remove {name}', { name: productLabel(b) })}
                        />
                      )}
                    </Flex>
                  </TableTh>
                ))}
                <TableTh scope="col" className="field-unit-cell">
                  {t('Unit')}
                </TableTh>
              </TableTr>
            </TableThead>
            {compareGroups(bullets, system, t).map((g) => (
              <TableTbody key={say(t, g.title)}>
                <TableTr className="field-group">
                  <TableTh scope="rowgroup" colSpan={bullets.length + 3}>
                    {say(t, g.title)}
                  </TableTh>
                </TableTr>
                {g.rows.map((row, k) => {
                  const marks = differenceMarks(row.values, turnPrefixOf(t))
                  const deltas = differenceToFirst(row.values, turnPrefixOf(t))
                  return (
                    // biome-ignore lint/suspicious/noArrayIndexKey: a label can repeat
                    <TableTr key={k} data-differs={rowDiffers(row.values) || undefined}>
                      <TableTd className="field-symbol">{row.symbol}</TableTd>
                      <TableTh scope="row">
                        {row.from === undefined
                          ? say(t, row.label)
                          : t('{label} from {velocity}', {
                              label: say(t, row.label),
                              velocity: row.from,
                            })}
                      </TableTh>
                      {row.values.map((v, i) => {
                        const mark = marks[i]
                        const delta = deltas[i]
                        return (
                          <TableTd key={ids[i]} className="num" data-mark={mark}>
                            {v ?? t('n/a')}
                            {delta && (
                              <span className="compare-delta">
                                {' '}
                                <span className="visually-hidden">
                                  {t('difference to the first bullet')}
                                </span>{' '}
                                ({delta})
                              </span>
                            )}
                            <span aria-hidden="true" className="diff-mark">
                              {mark === 'max' ? '▲' : mark === 'min' ? '▼' : ''}
                            </span>
                            {mark && (
                              <span className="visually-hidden"> ({t(markText[mark])})</span>
                            )}
                          </TableTd>
                        )
                      })}
                      <TableTd className="field-unit-cell">{row.unit}</TableTd>
                    </TableTr>
                  )
                })}
              </TableTbody>
            ))}
          </Table>
        </ScrollRegion>
        {/* the cells say "largest" or "smallest" themselves. Read alone, the legend lost its marks */}
        <p className="compare-legend" aria-hidden="true">
          {t(
            'Tinted: the values differ. ▲ largest, ▼ smallest value of a row. In brackets: the difference to the first bullet.',
          )}
        </p>
      </Panel>
      <Panel id="compare-drawings" title={msg('Drawings')} translated>
        <ScrollRegion label={t('Drawings')}>
          <div className="compare-drawings">
            {drawings.map((d, i) => (
              <figure key={ids[i]}>
                {d}
                <figcaption>{nth(bullets, i).name}</figcaption>
              </figure>
            ))}
          </div>
        </ScrollRegion>
      </Panel>
    </div>
  )
}
