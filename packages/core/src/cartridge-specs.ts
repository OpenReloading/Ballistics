import type { CartridgeDiameters } from './bullet-fit.ts'

/** The values of a cartridge record that `cartridgeBulletDiameterMm` and `cartridgeGrooveDiameterMm` read. */
export interface CartridgeSpecs {
  values: { side?: string; symbol: string; value?: number }[]
}

/** The smallest value of `symbol` on `side` among the values of a CIP sheet; undefined without one. */
export function leastSpecValue(
  values: readonly { side?: string | null; symbol: string; value?: number | null }[],
  side: string,
  symbol: string,
): number | undefined {
  const xs = values.flatMap((v) =>
    v.side === side && v.symbol === symbol && typeof v.value === 'number' ? [v.value] : [],
  )
  return xs.length > 0 ? Math.min(...xs) : undefined
}

/** G1 of a cartridge record, mm: the smallest cartridge-side value of its CIP sheet. */
export function cartridgeBulletDiameterMm(c: CartridgeSpecs): number | undefined {
  return leastSpecValue(c.values, 'cartridge', 'G1')
}

/** Groove diameter Z of a cartridge record's CIP chamber, mm (the first one). */
export function cartridgeGrooveDiameterMm(c: CartridgeSpecs): number | undefined {
  return c.values.find((v) => v.side === 'chamber' && v.symbol === 'Z' && v.value !== undefined)
    ?.value
}

/**
 * The values of a cartridge record that `bulletFits` reads, mm: the smallest cartridge-side G1 and
 * chamber-side F and Z of its CIP sheet, as `GET /cartridges` gives them; undefined when
 * one is missing.
 */
export function cartridgeDiameters(c: CartridgeSpecs): CartridgeDiameters | undefined {
  const [g1, land, groove] = [
    leastSpecValue(c.values, 'cartridge', 'G1'),
    leastSpecValue(c.values, 'chamber', 'F'),
    leastSpecValue(c.values, 'chamber', 'Z'),
  ]
  return g1 === undefined || land === undefined || groove === undefined
    ? undefined
    : { g1, land, groove }
}

/** Bore area Q of a cartridge record's CIP chamber, mm2 (the first one). */
export function cartridgeBoreAreaMm2(c: CartridgeSpecs): number | undefined {
  return c.values.find((v) => v.side === 'chamber' && v.symbol === 'Q' && v.value !== undefined)
    ?.value
}
