import { loadRatio } from '@open-reloading/core'
import { type Annotation, angleText, greek } from '@open-reloading/drawing'
import type { Seating } from '@open-reloading/drawing/seating'
import { toSi } from '@open-reloading/schema'
import { formatNumber } from '../i18n/number.ts'
import { type Message, msg, type Translator } from '../i18n/translate.ts'
import { formatQuantity, type UnitSystem, unitsOf } from './units.ts'

/** The powder charge in the seated case, as the seating figure draws it. */
export type ChargeFill =
  | { missing: Message[] }
  | {
      /** Charge, kg. */
      charge: number
      /** Charge bulk volume over the free volume behind the bullet (`loadRatio`), the case fill. */
      ratio: number
      /** Charge over the free volume, kg/m³. */
      loadingDensity: number
      /** The charge level from the head, mm in the part frame. */
      level: number
      /** The bullet base reaches into the charge: the case fill is over 1. */
      compressed: boolean
    }

/**
 * The charge fill of the case from the charge (kg), the powder's bulk density (kg/m³), the free
 * volume behind the seated bullet (m³) and the bullet base (mm from the head); without one of the
 * three inputs, what is missing.
 */
export function chargeFill(o: {
  charge: number | undefined
  bulkDensity: number | undefined
  volume: number | undefined
  base: number
}): ChargeFill {
  const { charge, bulkDensity, volume } = o
  const missing = [
    ...(charge === undefined ? [msg('a charge')] : []),
    ...(volume === undefined || !(volume > 0) ? [msg('a case capacity')] : []),
    ...(!bulkDensity ? [msg('the bulk density of the powder')] : []),
  ]
  if (missing.length > 0 || charge === undefined || volume === undefined) return { missing }
  // defined: the bulk density is given and the volume positive
  const ratio = loadRatio(charge, bulkDensity, volume) as number
  return {
    charge,
    ratio,
    loadingDensity: charge / volume,
    // shortcut: the free volume is taken as even from the head to the bullet base (no case interior
    // profile, web or taper), upgrade when the case interior is modelled
    level: o.base * Math.min(ratio, 1),
    compressed: ratio > 1,
  }
}

/** A row of the seating figure's values table: the name, the value and its unit. */
type ValueRow = { name: string; value: string; unit: string }

/**
 * The dimensions a figure draws, from the annotation of its side: lengths and diameters in the
 * page's length unit (`Dimension.value` is mm), angles in degrees, the ratio Rt/R as stored.
 */
function dimensionRows(annotation: Annotation, system: UnitSystem): ValueRow[] {
  const length = (mm: number) => formatQuantity('length', system, toSi('length', mm))
  return [
    ...annotation.dimensions.map((d) =>
      d.symbol === 'Rt/R'
        ? { name: d.symbol, value: String(d.value), unit: '' }
        : {
            name: `${d.kind === 'diameter' ? 'Ø' : ''}${d.symbol}`,
            value: length(d.value),
            unit: system.length.symbol,
          },
    ),
    ...annotation.radii.map((r) => ({
      name: r.symbol,
      value: length(r.value),
      unit: system.length.symbol,
    })),
    ...annotation.angles.map((a) => ({
      name: greek[a.symbol] ?? a.symbol,
      value: angleText(a.value).replace('°', ''),
      unit: '°',
    })),
  ]
}

/** The case fill as the workbench's Case fill readout writes it, percent without the sign. */
export const fillPercent = (ratio: number) => formatNumber(ratio * 100, 0)

/**
 * The rows of the seating figure's values table: the dimensions the shown view draws (none in
 * Combined, which then lists COAL and CBTO), the seating depth and the volume behind the bullet,
 * then the charge, the case fill and the loading density the figure's powder fill draws.
 */
export function seatingValueRows(
  o: {
    annotation: Annotation | undefined
    seating: Seating
    fill: ChargeFill | undefined
    system: UnitSystem
  },
  t: Translator['t'],
): ValueRow[] {
  const { annotation, seating, fill, system } = o
  const length = (mm: number) => ({
    value: formatQuantity('length', system, toSi('length', mm)),
    unit: system.length.symbol,
  })
  const drawn = annotation ? dimensionRows(annotation, system) : []
  const seated = drawn.some((r) => r.name === 'COAL')
    ? []
    : [
        { name: 'COAL', ...length(seating.coal.value) },
        ...(seating.cbto ? [{ name: 'CBTO', ...length(seating.cbto.value) }] : []),
      ]
  const volume = seating.volumeBehindBullet
  const filled = fill && !('missing' in fill) ? fill : undefined
  return [
    ...drawn,
    ...seated,
    { name: t('Seating depth'), ...length(seating.depth.value) },
    ...(volume
      ? [
          {
            name: t('Volume behind the bullet'),
            value: formatQuantity('capacity', system, unitsOf.capacity.cm3.toSi(volume.value)),
            unit: system.capacity.symbol,
          },
        ]
      : []),
    ...(filled
      ? [
          {
            name: t('Charge'),
            value: formatQuantity('charge', system, filled.charge),
            unit: system.charge.symbol,
          },
          { name: t('Case fill'), value: fillPercent(filled.ratio), unit: '%' },
          {
            // German writes the case fill as Ladedichte: this row is the charge over the volume
            name: t('fill\u0004Loading density'),
            value: formatQuantity('density', system, filled.loadingDensity),
            unit: system.density.symbol,
          },
        ]
      : []),
  ]
}
