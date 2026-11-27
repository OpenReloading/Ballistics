import { type ManufacturerNames, noManufacturerNames, productLabel } from './manufacturers.ts'

/** The title and description of a record page. */
export interface HeadText {
  title: string
  description: string
}

/** The title and description of a cartridge record page, shared by its page and the prerender check. */
function cartridgeHeadText(name: string) {
  return {
    title: `${name} dimensions and pressures`,
    description: `CIP dimensions and maximum pressures of ${name}, with sources.`,
  }
}

/** The data folder of each record kind with a record page. */
export type RecordKind =
  | 'cartridges'
  | 'bullets'
  | 'powders'
  | 'cases'
  | 'primers'
  | 'target-faces'
  | 'disciplines'
  | 'federations'

/** The fields of a record the head text reads. */
export interface HeadSource {
  id: string
  name?: string | undefined
  manufacturer?: string | undefined
}

/** The id a `catalogue:<id>` reference names. */
export const refId = (ref: string) => ref.slice(ref.indexOf(':') + 1)

/** Shared by the route's metadata and the prerender check. */
export function recordHeadText(
  kind: RecordKind,
  r: HeadSource,
  names: ManufacturerNames = noManufacturerNames,
): HeadText {
  const name = r.name ?? r.id
  const label = productLabel({ name, manufacturer: r.manufacturer && refId(r.manufacturer) }, names)
  switch (kind) {
    case 'cartridges':
      return cartridgeHeadText(name)
    case 'bullets':
      return {
        title: label,
        description: `Drawing, diameter, mass and ballistic coefficients of the ${label}, with sources.`,
      }
    case 'powders':
      return { title: label, description: `Recorded properties of ${label}, with sources.` }
    case 'cases':
      return {
        title: label,
        description: `Recorded properties of the brass ${label}, with sources.`,
      }
    case 'primers':
      return {
        title: label,
        description: `Recorded properties of the primer ${label}, with sources.`,
      }
    case 'target-faces':
      return {
        title: name,
        description: `Ring diameters, black area and the disciplines shot on ${name}, with sources.`,
      }
    case 'disciplines':
      return {
        title: name,
        description: `Distance, caliber classes and the targets of ${name}, with its rule book.`,
      }
    case 'federations':
      return {
        title: name,
        description: `The rule books of ${name}, its disciplines and the targets they use.`,
      }
  }
}
