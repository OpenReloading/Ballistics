'use client'

import { Table, TableTbody, TableTd, TableTh, TableThead, TableTr } from '@mantine/core'
import type { Powder } from '@open-reloading/schema'
import { useTranslation } from '../i18n/language.ts'
import { msg } from '../i18n/translate.ts'
import { fitTables } from '../lib/powder-record.ts'
import { Panel } from './panel.tsx'
import { ScrollRegion } from './scroll-region.tsx'

/** The load tables a powder's model was fitted to, with their training rows; none without a row count. */
export function PowderFit({ powder }: { powder: Powder }) {
  const { t } = useTranslation()
  if (!powder.interior) return null
  const tables = fitTables(powder)
  if (!tables.some((t) => t.trainingRows !== undefined)) return null
  const cartridges = tables.some((t) => t.trainingCartridges !== undefined)
  return (
    <Panel id="model-fit" title={msg('Model fit')} translated>
      <ScrollRegion label={t('Model fit table')}>
        <Table aria-labelledby="model-fit">
          <TableThead>
            <TableTr>
              <TableTh scope="col">{t('Load table')}</TableTh>
              <TableTh scope="col" className="num">
                {t('Rows')}
              </TableTh>
              {cartridges && (
                <TableTh scope="col" className="num">
                  {t('Cartridges')}
                </TableTh>
              )}
            </TableTr>
          </TableThead>
          <TableTbody>
            {tables.map((row) => (
              <TableTr key={row.title}>
                <TableTh scope="row">{row.title}</TableTh>
                <TableTd className="num">{row.trainingRows ?? t('n/a')}</TableTd>
                {cartridges && (
                  <TableTd className="num">{row.trainingCartridges ?? t('n/a')}</TableTd>
                )}
              </TableTr>
            ))}
          </TableTbody>
        </Table>
      </ScrollRegion>
    </Panel>
  )
}
