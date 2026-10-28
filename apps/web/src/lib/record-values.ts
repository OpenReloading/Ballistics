import { type Message, msg } from '../i18n/translate.ts'
import { verbatim, type Wording } from './wording.ts'

/** A record value as a name: "hollow-point" as "Hollow point". */
export const titleFromKebab = (value: string) =>
  (value.charAt(0).toUpperCase() + value.slice(1)).replaceAll('-', ' ')

/**
 * Stored values of the schema's enumerations that a record page shows as words, by the form the page
 * writes them in: as stored (`rawWording`), with spaces for hyphens (`spacedWording`) or capitalised
 * with spaces (`titleWording`). The English text of each message is the text the page showed before
 * the language was a setting. A value no message names (a later schema value, or one left
 * untranslated on purpose) shows as published, in the same form.
 */

const raw: Readonly<Record<string, Message>> = {
  // bullet structure
  'cup-and-core': msg('cup-and-core'),
  bonded: msg('bonded'),
  partitioned: msg('partitioned'),
  monolithic: msg('monolithic'),
  cast: msg('cast'),
  swaged: msg('swaged'),
  plated: msg('plated'),
  frangible: msg('frangible'),
  // ogive form
  tangent: msg('tangent'),
  secant: msg('secant'),
  hybrid: msg('hybrid'),
  'round-nose': msg('round-nose'),
  'flat-nose': msg('flat-nose'),
  // tip type
  'hollow-point': msg('hollow-point'),
  'polymer-tip': msg('polymer-tip'),
  'soft-point': msg('soft-point'),
  'full-metal-jacket': msg('full-metal-jacket'),
  'open-meplat': msg('open-meplat'),
  // base type
  flat: msg('flat'),
  'boat-tail': msg('boat-tail'),
  'rebated-boat-tail': msg('rebated-boat-tail'),
  'conical-hollow-base': msg('conical-hollow-base'),
  'rounded-hollow-base': msg('rounded-hollow-base'),
  // powder grain form and propellant base
  ball: msg('ball'),
  extruded: msg('extruded'),
  flake: msg('flake'),
  other: msg('other'),
  single: msg('single'),
  double: msg('double'),
  triple: msg('triple'),
}

// "powder coat" and "compressed powder" are left out: the catalogue test requires the German word
// for powder as the propellant in every text that says powder
const spaced: Readonly<Record<string, Message>> = {
  // jacket and core materials
  copper: msg('copper'),
  'gilding-metal': msg('gilding metal'),
  'copper-clad-steel': msg('copper clad steel'),
  'copper-plated-steel': msg('copper plated steel'),
  steel: msg('steel'),
  lead: msg('lead'),
  'lead-alloy': msg('lead alloy'),
  'copper-alloy': msg('copper alloy'),
  tin: msg('tin'),
  tungsten: msg('tungsten'),
  // surface treatments
  moly: msg('moly'),
  'black-oxide': msg('black oxide'),
  'polymer-coat': msg('polymer coat'),
  paint: msg('paint'),
  'wax-lube': msg('wax lube'),
  'boron-nitride': msg('boron nitride'),
  'tungsten-disulfide': msg('tungsten disulfide'),
  'copper-wash': msg('copper wash'),
  'lead-wash': msg('lead wash'),
}

// a primer cup of brass is left out: the catalogue test requires the German word for a cartridge case in every text that says brass
const title: Readonly<Record<string, Message>> = {
  // case wall materials
  brass: msg('Brass'),
  'nickel-plated-brass': msg('Nickel plated brass'),
  'lacquered-steel': msg('Lacquered steel'),
  'polymer-coated-steel': msg('Polymer coated steel'),
  aluminium: msg('Aluminium'),
  // primer sizes and compounds
  'small-rifle': msg('Small rifle'),
  'large-rifle': msg('Large rifle'),
  'small-pistol': msg('Small pistol'),
  'large-pistol': msg('Large pistol'),
  shotshell: msg('Shotshell'),
  'lead-styphnate': msg('Lead styphnate'),
  'lead-free': msg('Lead free'),
}

/** A value as stored ("boat-tail", "extruded"). */
export const rawWording = (value: string): Wording => raw[value] ?? verbatim(value)

/** A value with its hyphens as spaces ("gilding metal"). */
export const spacedWording = (value: string): Wording =>
  spaced[value] ?? verbatim(value.replaceAll('-', ' '))

/** A value capitalised, hyphens as spaces ("Nickel plated brass"). */
export const titleWording = (value: string): Wording =>
  title[value] ?? verbatim(titleFromKebab(value))

/** A primer cup's material: as `titleWording`, but a cup is no case, so brass stays as published. */
export const cupWording = (value: string): Wording =>
  value === 'copper'
    ? msg('Copper')
    : value === 'steel'
      ? msg('Steel')
      : verbatim(titleFromKebab(value))

const methods: Readonly<Record<string, Message>> = {
  transducer: msg('transducer'),
  piezo: msg('piezo'),
  crusher: msg('crusher'),
  energy: msg('energy'),
}

/** The pressure measuring method of a cartridge record. */
export const methodWording = (value: string): Wording => methods[value] ?? verbatim(value)

/** A yes or no value, lower case as the bullet table writes it, or capitalised as the case and primer tables do. */
export const yesNo = (value: boolean, capitalised = false): Wording =>
  capitalised ? (value ? msg('Yes') : msg('No')) : value ? msg('yes') : msg('no')
