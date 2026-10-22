import { Table, TableTbody, TableTd, TableTh, TableThead, TableTr } from '@mantine/core'
import type { PowderRecord } from '../lib/api-types.ts'
import { fitTables } from '../lib/powder-record.ts'
import { Panel } from './panel.tsx'
import { ScrollRegion } from './scroll-region.tsx'

/** The load tables a powder's model was fitted to, with their training rows; none without a row count. */
export function PowderFit({ powder }: { powder: PowderRecord }) {
  if (!powder.interior) return null
  const tables = fitTables(powder)
  if (!tables.some((t) => t.trainingRows !== undefined)) return null
  const cartridges = tables.some((t) => t.trainingCartridges !== undefined)
  return (
    <Panel id="model-fit" title="Model fit">
      <ScrollRegion label="Model fit table">
        <Table aria-labelledby="model-fit">
          <TableThead>
            <TableTr>
              <TableTh scope="col">Load table</TableTh>
              <TableTh scope="col" className="num">
                Rows
              </TableTh>
              {cartridges && (
                <TableTh scope="col" className="num">
                  Cartridges
                </TableTh>
              )}
            </TableTr>
          </TableThead>
          <TableTbody>
            {tables.map((t) => (
              <TableTr key={t.title}>
                <TableTh scope="row">{t.title}</TableTh>
                <TableTd className="num">{t.trainingRows ?? 'n/a'}</TableTd>
                {cartridges && <TableTd className="num">{t.trainingCartridges ?? 'n/a'}</TableTd>}
              </TableTr>
            ))}
          </TableTbody>
        </Table>
      </ScrollRegion>
    </Panel>
  )
}
