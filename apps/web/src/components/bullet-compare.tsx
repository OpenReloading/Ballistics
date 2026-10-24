'use client'

import {
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
import type { Bullet } from '@openreloading/schema'
import Link from 'next/link'
import type { CSSProperties, ReactNode } from 'react'
import { compareGroups, differenceMarks, rowDiffers } from '../lib/bullet-compare.ts'
import { caliberLabel, caliberUnit } from '../lib/caliber.ts'
import { compareHref } from '../lib/compare-ids.ts'
import { productLabel } from '../lib/manufacturers.ts'
import { RecordScope, UnitSwitch } from './cartridge-record.tsx'
import { Panel } from './panel.tsx'
import { ScrollRegion } from './scroll-region.tsx'
import { useUnits } from './units-settings.tsx'

const markText = { max: 'largest', min: 'smallest' } as const

/**
 * Bullets as columns: the drawings at one scale in one panel with the mm or in switch, then the
 * bullet data in the groups of the bullet record (symbol, quantity, a value per bullet, unit),
 * the head of each column the name, caliber and a remove button. A row whose values differ is
 * tinted, the largest and smallest of a numeric row marked, "n/a" where a record has no value.
 * On a phone the tables scroll sideways inside their panels.
 */
export function BulletCompare({
  bullets,
  drawings,
}: {
  bullets: (Bullet & { manufacturerName: string })[]
  drawings: ReactNode[]
}) {
  return (
    <RecordScope>
      <Values bullets={bullets} drawings={drawings} />
    </RecordScope>
  )
}

function Values({
  bullets,
  drawings,
}: {
  bullets: (Bullet & { manufacturerName: string })[]
  drawings: ReactNode[]
}) {
  const { system } = useUnits()
  const ids = bullets.map((b) => b.id)
  const style = { '--n': bullets.length } as CSSProperties
  return (
    <div className="bullet-compare" style={style}>
      <Panel id="compare-drawings" title="Drawings" controls={<UnitSwitch />}>
        <ScrollRegion label="Drawings">
          <div className="compare-drawings">
            {drawings.map((d, i) => (
              <figure key={ids[i]}>
                {d}
                <figcaption>{bullets[i].name}</figcaption>
              </figure>
            ))}
          </div>
        </ScrollRegion>
      </Panel>
      <Panel id="compare-data" title="Bullet data">
        <ScrollRegion label="Bullet data table">
          <Table className="field-table symbol-table compare-table" aria-labelledby="compare-data">
            <TableThead>
              <TableTr>
                <TableTh scope="col" className="field-symbol">
                  Symbol
                </TableTh>
                <TableTh scope="col">Quantity</TableTh>
                {bullets.map((b) => (
                  <TableTh key={b.id} scope="col">
                    <Flex align="flex-start" justify="space-between" gap={4}>
                      <span className="compare-name">
                        <Text component="span" inherit c="dimmed" fz="xs" fw={400}>
                          {b.manufacturerName}
                        </Text>
                        <Link href={`/bullets/${b.id}`}>{b.name}</Link>
                        <Text component="span" inherit c="dimmed" fz="xs" fw={400}>
                          {caliberLabel(b.diameter.value, caliberUnit(system))}
                        </Text>
                      </span>
                      {bullets.length > 1 && (
                        <CloseButton
                          component={Link}
                          href={compareHref(ids.filter((id) => id !== b.id))}
                          className="screen-only"
                          aria-label={`Remove ${productLabel(b)}`}
                        />
                      )}
                    </Flex>
                  </TableTh>
                ))}
                <TableTh scope="col" className="field-unit-cell">
                  Unit
                </TableTh>
              </TableTr>
            </TableThead>
            {compareGroups(bullets, system).map((g) => (
              <TableTbody key={g.title}>
                <TableTr className="field-group">
                  <TableTh scope="rowgroup" colSpan={bullets.length + 3}>
                    {g.title}
                  </TableTh>
                </TableTr>
                {g.rows.map((row, k) => {
                  const marks = differenceMarks(row.values)
                  return (
                    // biome-ignore lint/suspicious/noArrayIndexKey: a label can repeat
                    <TableTr key={k} data-differs={rowDiffers(row.values) || undefined}>
                      <TableTd className="field-symbol">{row.symbol}</TableTd>
                      <TableTh scope="row">{row.label}</TableTh>
                      {row.values.map((v, i) => {
                        const mark = marks[i]
                        return (
                          <TableTd key={ids[i]} className="num" data-mark={mark}>
                            {v ?? 'n/a'}
                            <span aria-hidden="true" className="diff-mark">
                              {mark === 'max' ? '▲' : mark === 'min' ? '▼' : ''}
                            </span>
                            {mark && <span className="visually-hidden"> ({markText[mark]})</span>}
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
          Tinted: the values differ. ▲ largest, ▼ smallest value of a row.
        </p>
      </Panel>
    </div>
  )
}
