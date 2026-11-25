'use client'

import { useLingui } from '@lingui/react'
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
import type { Bullet } from '@rangefoundry/schema'
import { FlaskConical, Plus } from 'lucide-react'
import dynamic from 'next/dynamic'
import { type CSSProperties, type ReactNode, useState } from 'react'
import Link from '@/platform/link.tsx'
import { useRouter } from '@/platform/navigation.ts'
import { useTranslation } from '../i18n/language.ts'
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
import { Panel } from './panel.tsx'
import { ScrollRegion } from './scroll-region.tsx'
import { useUnits } from './units-settings.tsx'

/** The bullet search, a chunk of its own: the comparison loads it on the first Add bullet. */
const CompareAddChooser = dynamic(
  () => import('./compare-add-chooser.tsx').then((m) => m.CompareAddChooser),
  { ssr: false },
)

const markText = {
  max: /*i18n*/ { id: 'bulletCompare.largest', message: 'largest' },
  min: /*i18n*/ { id: 'bulletCompare.smallest', message: 'smallest' },
} as const

/** "Add bullet": the bullet search over the catalogue; the chosen bullet joins the comparison as its last column. */
function AddBullet({ ids }: { ids: string[] }) {
  const { i18n } = useLingui()
  const { system } = useUnits()
  const router = useRouter()
  const [opened, setOpened] = useState(false)
  // mounted from the first click on: the search's code loads then
  const [wanted, setWanted] = useState(false)
  if (ids.length >= maxComparedBullets) return null
  return (
    <>
      <Button
        variant="default"
        size={controlSize.row.button}
        leftSection={<Plus aria-hidden="true" />}
        className="screen-only"
        onClick={() => {
          setWanted(true)
          setOpened(true)
        }}
      >
        {i18n._({ id: 'bulletCompare.add', message: 'Add bullet' })}
      </Button>
      {wanted && (
        <CompareAddChooser
          opened={opened}
          onClose={() => setOpened(false)}
          system={system}
          onChoose={(row) => {
            setOpened(false)
            if (!ids.includes(row.id)) router.push(compareHref([...ids, row.id]))
          }}
        />
      )}
    </>
  )
}

/** Differing rows tinted, each later value with its difference to the first bullet's, "n/a" where a record has none; on a phone the tables scroll sideways inside their panels. */
export function BulletCompare({
  bullets,
  drawings,
}: {
  bullets: (Bullet & { manufacturerName: string })[]
  drawings: ReactNode[]
}) {
  const { system } = useUnits()
  const { t } = useTranslation()
  const { i18n } = useLingui()
  const ids = bullets.map((b) => b.id)
  const style = { '--n': bullets.length } as CSSProperties
  return (
    <div className="bullet-compare" style={style}>
      <Panel
        id="compare-data"
        title={/*i18n*/ { id: 'bulletCompare.data', message: 'Bullet data' }}
        translated
        controls={<AddBullet ids={ids} />}
      >
        <ScrollRegion
          label={i18n._({ id: 'bulletCompare.dataTable', message: 'Bullet data table' })}
        >
          <Table className="field-table symbol-table compare-table" aria-labelledby="compare-data">
            <TableThead>
              <TableTr>
                <TableTh scope="col" className="field-symbol">
                  {i18n._({ id: 'bulletCompare.symbol', message: 'Symbol' })}
                </TableTh>
                <TableTh scope="col">
                  {i18n._({ id: 'bulletCompare.quantity', message: 'Quantity' })}
                </TableTh>
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
                          aria-label={i18n._({
                            id: 'bulletCompare.useInWorkbenchFor',
                            message: 'Use in workbench: {name}',
                            values: { name: productLabel(b) },
                          })}
                        >
                          <FlaskConical aria-hidden="true" />
                          {i18n._({
                            id: 'bulletCompare.useInWorkbench',
                            message: 'Use in workbench',
                          })}
                        </Link>
                      </span>
                      {bullets.length > 1 && (
                        <CloseButton
                          component={Link}
                          href={compareHref(ids.filter((id) => id !== b.id))}
                          className="screen-only"
                          aria-label={i18n._({
                            id: 'bulletCompare.remove',
                            message: 'Remove {name}',
                            values: { name: productLabel(b) },
                          })}
                        />
                      )}
                    </Flex>
                  </TableTh>
                ))}
                <TableTh scope="col" className="field-unit-cell">
                  {i18n._({ id: 'bulletCompare.unit', message: 'Unit' })}
                </TableTh>
              </TableTr>
            </TableThead>
            {compareGroups(bullets, system, t, i18n).map((g) => (
              <TableTbody key={say(i18n, t, g.title)}>
                <TableTr className="field-group">
                  <TableTh scope="rowgroup" colSpan={bullets.length + 3}>
                    {say(i18n, t, g.title)}
                  </TableTh>
                </TableTr>
                {g.rows.map((row, k) => {
                  const marks = differenceMarks(row.values, turnPrefixOf(i18n))
                  const deltas = differenceToFirst(row.values, turnPrefixOf(i18n))
                  return (
                    // oxlint-disable-next-line react/no-array-index-key -- a label can repeat
                    <TableTr key={k} data-differs={rowDiffers(row.values) || undefined}>
                      <TableTd className="field-symbol">{row.symbol}</TableTd>
                      <TableTh scope="row">
                        {row.from === undefined
                          ? say(i18n, t, row.label)
                          : i18n._({
                              id: 'bulletCompare.labelFrom',
                              message: '{label} from {velocity}',
                              values: { label: say(i18n, t, row.label), velocity: row.from },
                            })}
                      </TableTh>
                      {row.values.map((v, i) => {
                        const mark = marks[i]
                        const delta = deltas[i]
                        return (
                          <TableTd key={ids[i]} className="num" data-mark={mark}>
                            {v ?? i18n._({ id: 'bulletCompare.notAvailable', message: 'n/a' })}
                            {delta && (
                              <span className="compare-delta">
                                {' '}
                                <span className="visually-hidden delta-name">
                                  {i18n._({
                                    id: 'bulletCompare.difference',
                                    message: 'difference to the first bullet',
                                  })}
                                </span>{' '}
                                ({delta})
                              </span>
                            )}
                            <span aria-hidden="true" className="diff-mark">
                              {mark === 'max' ? '▲' : mark === 'min' ? '▼' : ''}
                            </span>
                            {mark && (
                              <span className="visually-hidden"> ({i18n._(markText[mark])})</span>
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
          {i18n._({
            id: 'bulletCompare.legend',
            message:
              'Tinted: values differ. ▲ largest, ▼ smallest in a row. In brackets: difference to the first bullet.',
          })}
        </p>
      </Panel>
      <Panel
        id="compare-drawings"
        title={/*i18n*/ { id: 'bulletCompare.drawings', message: 'Drawings' }}
        translated
      >
        <ScrollRegion label={i18n._({ id: 'bulletCompare.drawingsRegion', message: 'Drawings' })}>
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
