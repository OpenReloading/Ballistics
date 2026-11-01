/**
 * The labels of record fields as the record pages name them, by record kind: what a source's field
 * list (`provenance.sources[].fields`, dot paths of schema keys) reads as in the Sources table.
 */
import { type Message, msg, type Translator } from '../i18n/translate.ts'

/**
 * The labels that differ from the key in words, by record kind; every other key reads as its words
 * (`waterCapacity`: "Water capacity"), translated where the catalogue has that text.
 */
const labels: Record<string, Record<string, Message>> = {
  powders: {
    grainForm: msg('Form'),
    propellantBase: msg('Base'),
    interior: msg('Model parameters'),
    listedCartridges: msg('Listed by the manufacturer for'),
  },
}

/** A schema key in words: `listedCartridges` reads "Listed cartridges", `base.type` "Base type". */
const humanised = (key: string) => {
  const words = key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replaceAll('.', ' ')
    .toLowerCase()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

/** The label of the record field at the dot path `key` for a record of `kind`, in the language of `t`. */
export function fieldLabel(key: string, kind: string | undefined, t: Translator['t']): string {
  const map = kind && Object.hasOwn(labels, kind) ? labels[kind] : undefined
  // own keys only: a source's field `constructor` reads as its words, not as Object's
  const own = map && Object.hasOwn(map, key) ? map[key] : undefined
  return t(own ?? (humanised(key) as Message))
}
