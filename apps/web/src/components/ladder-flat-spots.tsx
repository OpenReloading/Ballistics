import { useTranslation } from '../i18n/language.ts'
import { formatNumber } from '../i18n/number.ts'
import { msg } from '../i18n/translate.ts'
import type { ChargeRow } from '../lib/measurements.ts'
import { seriesFlatSpots } from '../lib/measurements.ts'
import { type UnitSystem, withUnit } from '../lib/units.ts'
import { PanelTable } from './scroll-region.tsx'

const columns = [msg('Charges'), msg('Shots'), msg('Slope'), msg('Band'), msg('Flat')] as const

/**
 * Where the measured mean velocity changes least with charge, per series
 * (`apps/docs/docs/models/interior-velocity-ladder.md`).
 */
export function LadderFlatSpots({
  series,
  system,
}: {
  series: { id: string; name: string; rows: ChargeRow[] }[]
  system: UnitSystem
}) {
  const { t } = useTranslation()
  const found = series.flatMap((s) => {
    const result = seriesFlatSpots(s.rows)
    return result ? [{ id: s.id, name: s.name, result }] : []
  })
  const [first] = found
  if (!first) return null
  const charge = (kg: number) => withUnit('charge', system, kg)
  // velocity per charge, from the unit scales of the two quantities
  const scale = (q: 'velocity' | 'charge') => system[q].fromSi(1) - system[q].fromSi(0)
  const perCharge = scale('velocity') / scale('charge')
  const rate = (x: number) => formatNumber(x * perCharge, 1)
  return (
    <>
      <h3>{t('Velocity flat spots')}</h3>
      <p className="note">
        {t(
          'A flat spot is a statistical observation of the strings fired: neighbouring charges whose slope of mean velocity has a {level} % band that includes zero. Few shots make wide bands. It is not a safety statement and not a charge to load.',
          { level: Math.round(first.result.level * 100) },
        )}
      </p>
      {found.map(({ id, name, result }) => (
        <div key={id}>
          <p>
            {result.flatSpots.length === 0
              ? t('{name}: no flat spot between these strings.', { name })
              : t('{name}: flat from {spots}.', {
                  name,
                  spots: result.flatSpots
                    .map((f) =>
                      t('{from} to {to} (strings of {counts} shots)', {
                        from: charge(f.from),
                        to: charge(f.to),
                        counts: f.counts.join(', '),
                      }),
                    )
                    .join('; '),
                })}
          </p>
          <PanelTable
            label={t('Velocity slope per charge, {name}', { name })}
            className="limits"
            caption={t(
              'Slope of mean velocity against charge between neighbouring strings ({velocity} per {charge})',
              { velocity: system.velocity.symbol, charge: system.charge.symbol },
            )}
            columns={columns.map((c) => t(c))}
          >
            {result.segments.map((s) => (
              <tr key={s.from}>
                <td data-label={t(columns[0])}>
                  {charge(s.from)} to {charge(s.to)}
                </td>
                <td data-label={t(columns[1])} className="num">
                  {s.counts.join(', ')}
                </td>
                <td data-label={t(columns[2])} className="num">
                  {rate(s.slope)}
                </td>
                <td data-label={t(columns[3])} className="num">
                  ±{rate(s.halfWidth)}
                </td>
                <td data-label={t(columns[4])}>{s.flat ? t('yes') : t('no')}</td>
              </tr>
            ))}
          </PanelTable>
        </div>
      ))}
    </>
  )
}
