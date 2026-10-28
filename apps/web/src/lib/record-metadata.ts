import type { Metadata, ResolvingMetadata } from 'next'
import { type ManufacturerNames, noManufacturerNames, productLabel } from './manufacturers.ts'

/** The root layout's title template: a page's `<title>` takes it, its Open Graph and Twitter titles do not. */
export const titleTemplate = '%s · OpenReloading Ballistics'

/**
 * The head tags of a record page: its own title and description, repeated in the Open Graph and
 * Twitter tags a link preview reads. A page's `openGraph` and `twitter` replace the layout's, so
 * those are spread from `parent` to keep the site image and the card type.
 */
export async function recordMetadata(
  parent: ResolvingMetadata,
  title: string,
  description: string,
): Promise<Metadata> {
  const { openGraph, twitter } = await parent
  return {
    title,
    description,
    openGraph: { ...openGraph, title, description },
    // a card with the site image is the large one, as the layout's tags read
    twitter: {
      ...twitter,
      ...((twitter?.images ?? openGraph?.images) && { card: 'summary_large_image' as const }),
      title,
      description,
    },
  }
}

/** The title and description of a record page. */
export interface HeadText {
  title: string
  description: string
}

/** The title and description of a cartridge record page, shared by its page and the prerender check. */
export function cartridgeHeadText(name: string) {
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

/**
 * The title and description of the record page of `kind`, shared by the route's metadata and the
 * prerender check. `names` holds the manufacturer names that a bullet, powder, case or primer's label
 * leads with.
 */
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
