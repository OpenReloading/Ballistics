/**
 * The labels of record fields as the record pages name them, by record kind: what a source's field
 * list (`provenance.sources[].fields`, dot paths of schema keys) reads as in the Sources table.
 */
import { type Message, msg, type Translator } from '../i18n/translate.ts'

/** The record kinds with labels of their own; any other kind reads its keys humanised. */
export type LabelledKind = 'powders' | 'bullets' | 'cases' | 'primers'

const shared: Record<string, Message> = {
  name: msg('Name'),
  aliases: msg('Aliases'),
  country: msg('Country'),
}

const labels: Record<LabelledKind, Record<string, Message>> = {
  powders: {
    ...shared,
    grainForm: msg('Form'),
    propellantBase: msg('Base'),
    bulkDensity: msg('Bulk density'),
    composition: msg('Composition'),
    thermochemistry: msg('Thermochemistry'),
    interior: msg('Model parameters'),
    listedCartridges: msg('Listed by the manufacturer for'),
  },
  bullets: {
    ...shared,
    diameter: msg('Diameter'),
    mass: msg('Mass'),
    length: msg('Length'),
    ballisticCoefficients: msg('Ballistic coefficients'),
    base: msg('Base'),
    'base.type': msg('Base type'),
    'base.length': msg('Base length'),
    baseToOgive: msg('Base to ogive'),
    bearingLength: msg('Bearing length'),
    construction: msg('Construction'),
    'construction.core': msg('Core'),
    'construction.jacket': msg('Jacket'),
    meplatDiameter: msg('Meplat diameter'),
    noseLength: msg('Nose length'),
    ogive: msg('Ogive'),
    tip: msg('Tip'),
    recommendedTwist: msg('Recommended twist'),
    slowestTwist: msg('Slowest twist'),
  },
  cases: {
    ...shared,
    mass: msg('Mass'),
    material: msg('Material'),
    annealed: msg('Annealed'),
    primerPocket: msg('Primer pocket'),
    waterCapacity: msg('Water capacity'),
  },
  primers: {
    ...shared,
    size: msg('Size'),
    compound: msg('Compound'),
    magnum: msg('Magnum'),
    intendedUse: msg('Intended use'),
  },
}

/** A schema key in words: `listedCartridges` reads "Listed cartridges". */
const humanised = (key: string) => {
  const words = key.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

/**
 * The label of the record field at the dot path `key` for a record of `kind`, in the language of
 * `t`: its own label, else its parent's label with the rest humanised, else the key humanised.
 */
export function fieldLabel(key: string, kind: string | undefined, t: Translator['t']): string {
  const own = kind && kind in labels ? labels[kind as LabelledKind] : {}
  const label = own[key]
  if (label) return t(label)
  const parts = key.split('.')
  for (let i = parts.length - 1; i > 0; i--) {
    const parent = own[parts.slice(0, i).join('.')]
    if (parent) return [t(parent), ...parts.slice(i).map(humanised)].join(', ')
  }
  return parts.map(humanised).join(', ')
}
