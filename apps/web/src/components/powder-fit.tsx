'use client'

import { useLingui } from '@lingui/react'
import { Table, TableTbody, TableTd, TableTh, TableThead, TableTr } from '@mantine/core'
import type { Powder } from '@rangefoundry/schema'
import { loadEnglish } from '../i18n/lingui.ts'
import { fitTables } from '../lib/powder-record.ts'
import englishMessages from '../locales/en/components/powder-fit.json' with { type: 'json' }
import { Panel } from './panel.tsx'
import { ScrollRegion } from './scroll-region.tsx'

loadEnglish(englishMessages)

/** The load tables a powder's model was fitted to, with their training rows; none without a row count. */
export function PowderFit({ powder }: { powder: Powder }) {
  const { i18n } = useLingui()
  if (!powder.interior) return null
  const tables = fitTables(powder)
  if (!tables.some((t) => t.trainingRows !== undefined)) return null
  const cartridges = tables.some((t) => t.trainingCartridges !== undefined)
  const none = i18n._({ id: 'powderRecord.notAvailable', message: 'n/a' })
  return (
    <Panel
      id="model-fit"
      title={/*i18n*/ { id: 'powderRecord.modelFit', message: 'Model fit' }}
      translated
    >
      <ScrollRegion
        label={i18n._({ id: 'powderRecord.modelFitTable', message: 'Model fit table' })}
      >
        <Table aria-labelledby="model-fit">
          <TableThead>
            <TableTr>
              <TableTh scope="col">
                {i18n._({ id: 'powderRecord.loadTable', message: 'Load table' })}
              </TableTh>
              <TableTh scope="col" className="num">
                {i18n._({ id: 'powderRecord.rows', message: 'Rows' })}
              </TableTh>
              {cartridges && (
                <TableTh scope="col" className="num">
                  {i18n._({ id: 'powderRecord.cartridges', message: 'Cartridges' })}
                </TableTh>
              )}
            </TableTr>
          </TableThead>
          <TableTbody>
            {tables.map((row) => (
              <TableTr key={row.title}>
                <TableTh scope="row">{row.title}</TableTh>
                <TableTd className="num">{row.trainingRows ?? none}</TableTd>
                {cartridges && <TableTd className="num">{row.trainingCartridges ?? none}</TableTd>}
              </TableTr>
            ))}
          </TableTbody>
        </Table>
      </ScrollRegion>
    </Panel>
  )
}
