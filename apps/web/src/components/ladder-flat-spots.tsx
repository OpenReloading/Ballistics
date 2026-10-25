import type { ChargeRow } from '../lib/measurements.ts'
import { seriesFlatSpots } from '../lib/measurements.ts'
import { formatNumber, type UnitSystem, withUnit } from '../lib/units.ts'
import { PanelTable } from './scroll-region.tsx'

const columns = ['Charges', 'Shots', 'Slope', 'Band', 'Flat'] as const

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
      <h3>Velocity flat spots</h3>
      <p className="note">
        A flat spot is a statistical observation of the strings fired: neighbouring charges whose
        slope of mean velocity has a {Math.round(first.result.level * 100)} % band that includes
        zero. Few shots make wide bands. It is not a safety statement and not a charge to load.
      </p>
      {found.map(({ id, name, result }) => (
        <div key={id}>
          <p>
            {name}:{' '}
            {result.flatSpots.length === 0
              ? 'no flat spot between these strings.'
              : `flat from ${result.flatSpots
                  .map(
                    (f) =>
                      `${charge(f.from)} to ${charge(f.to)} (strings of ${f.counts.join(', ')} shots)`,
                  )
                  .join('; ')}.`}
          </p>
          <PanelTable
            label={`Velocity slope per charge, ${name}`}
            className="limits"
            caption={`Slope of mean velocity against charge between neighbouring strings (${system.velocity.symbol} per ${system.charge.symbol})`}
            columns={columns}
          >
            {result.segments.map((s) => (
              <tr key={s.from}>
                <td data-label={columns[0]}>
                  {charge(s.from)} to {charge(s.to)}
                </td>
                <td data-label={columns[1]} className="num">
                  {s.counts.join(', ')}
                </td>
                <td data-label={columns[2]} className="num">
                  {rate(s.slope)}
                </td>
                <td data-label={columns[3]} className="num">
                  ±{rate(s.halfWidth)}
                </td>
                <td data-label={columns[4]}>{s.flat ? 'yes' : 'no'}</td>
              </tr>
            ))}
          </PanelTable>
        </div>
      ))}
    </>
  )
}
