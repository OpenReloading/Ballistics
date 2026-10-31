import { Table } from '@mantine/core'
import { useTranslation } from '../i18n/language.ts'
import { plainNumber } from '../i18n/number.ts'
import { type LadderImpact, minGroups, minShots } from '../lib/ladder-impact.ts'
import { formatQuantity, type UnitSystem as System } from '../lib/units.ts'
import { LazyLineChart } from './lazy-chart.tsx'
import { MessageSlot } from './states.tsx'

/**
 * The point of impact per charge of a ladder: the note when the residual centre changes with the
 * charge, the warning about the simulated drop slope, and the chart of the centres with their
 * standard errors (`apps/docs/docs/models/interior-ladder-impact.md`). Before a velocity is linked
 * it shows nothing; afterwards, what is still missing.
 */
export function LadderImpactNote({ impact, system }: { impact: LadderImpact; system: System }) {
  const { t } = useTranslation()
  if (impact.status === 'none') return null
  if (impact.status !== 'ready')
    return (
      <p className="note">
        {impact.status === 'data' &&
          t(
            'The point of impact per charge needs three charges with {groups} groups of {shots} shots, each shot with a chronograph velocity and each group a point of aim.',
            { groups: plainNumber(minGroups), shots: plainNumber(minShots) },
          )}
        {impact.status === 'distance' &&
          t('The point of impact per charge needs all ladder groups at one distance.')}
        {impact.status === 'slope' &&
          t(
            'The point of impact per charge needs the simulated drop slope: a bullet with one usable ballistic coefficient, the sight height and the zero range. Several coefficients without velocity bands give no slope.',
          )}
      </p>
    )
  const { points, varies, level } = impact
  const len = system.length
  return (
    <div className="ladder-impact">
      <MessageSlot
        label={t('Point of impact per charge')}
        messages={[
          ...(varies
            ? [
                {
                  severity: 'info' as const,
                  text: t(
                    'The vertical centre changes with the charge by more than the simulated drop explains ({level} % test).',
                    { level: plainNumber(level * 100) },
                  ),
                },
              ]
            : []),
          {
            severity: 'warning' as const,
            text: t(
              'The drop slope is simulated in the ICAO standard atmosphere; a slope that is off leaves a trend with the charge, which this test reports too.',
            ),
          },
        ]}
      />
      <LazyLineChart
        x={points.map((p) => system.charge.fromSi(p.charge))}
        y={points.map((p) => len.fromSi(p.centre))}
        bars={points.map((p) => len.fromSi(p.standardError))}
        xLabel={t('Charge ({unit})', { unit: system.charge.symbol })}
        yLabel={t('Residual centre ({unit})', { unit: len.symbol })}
        title={t('Vertical centre of the groups against charge, velocity effect removed')}
        description={t(
          'Mean height of the shots above the point of aim with the effect of their velocity removed, per charge, with a bar of one standard error; the table lists the values.',
        )}
        height={200}
        points
      />
      <Table className="readout-table" withRowBorders horizontalSpacing={4} verticalSpacing={0}>
        <caption className="visually-hidden">{t('Residual centre per charge')}</caption>
        <Table.Thead>
          <Table.Tr>
            <Table.Th scope="col">{system.charge.symbol}</Table.Th>
            <Table.Th scope="col">{t('Shots')}</Table.Th>
            <Table.Th scope="col">{t('Centre ({unit})', { unit: len.symbol })}</Table.Th>
            <Table.Th scope="col">{t('Standard error ({unit})', { unit: len.symbol })}</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {points.map((p) => (
            <Table.Tr key={p.charge}>
              <Table.Th scope="row">{formatQuantity('charge', system, p.charge)}</Table.Th>
              <Table.Td>{plainNumber(p.shots)}</Table.Td>
              <Table.Td>{formatQuantity('length', system, p.centre)}</Table.Td>
              <Table.Td>{formatQuantity('length', system, p.standardError)}</Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </div>
  )
}
