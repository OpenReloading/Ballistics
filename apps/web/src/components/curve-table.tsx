import {
  Table,
  TableCaption,
  TableTbody,
  TableTd,
  TableTh,
  TableThead,
  TableTr,
} from '@mantine/core'
import { curveAt, type FittedPowder, tableBurntFractions, vivacityUnit } from '../lib/burn-rate.ts'
import { formatNumber } from '../lib/units.ts'
import { ScrollRegion } from './scroll-region.tsx'

const f = (v: number | undefined) => (v === undefined ? '' : formatNumber(v, 2))

/**
 * Dynamic vivacity at burnt fraction 0 to 1 in steps of 0.1: value, low and high for one powder,
 * one value column per powder for several.
 */
export function CurveTable({ powders, caption }: { powders: FittedPowder[]; caption: string }) {
  const only = powders.length === 1 ? powders[0] : undefined
  const heads = only
    ? [`Value, ${vivacityUnit}`, 'Low', 'High']
    : powders.map((p) => `${p.label}, ${vivacityUnit}`)
  return (
    <ScrollRegion label={caption}>
      <Table captionSide="top" stickyHeader>
        <TableCaption>{caption}</TableCaption>
        <TableThead>
          <TableTr>
            <TableTh scope="col">Burnt fraction z</TableTh>
            {heads.map((h) => (
              <TableTh key={h} scope="col" className="num">
                {h}
              </TableTh>
            ))}
          </TableTr>
        </TableThead>
        <TableTbody>
          {tableBurntFractions.map((z) => (
            <TableTr key={z}>
              <TableTh scope="row">{formatNumber(z, 1)}</TableTh>
              {only
                ? (() => {
                    const v = curveAt(only, z)
                    return [v.value, v.low, v.high].map((x, i) => (
                      <TableTd key={heads[i]} className="num">
                        {f(x)}
                      </TableTd>
                    ))
                  })()
                : powders.map((p) => (
                    <TableTd key={p.id} className="num">
                      {f(curveAt(p, z).value)}
                    </TableTd>
                  ))}
            </TableTr>
          ))}
        </TableTbody>
      </Table>
    </ScrollRegion>
  )
}
