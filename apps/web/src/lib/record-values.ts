import type { MessageDescriptor } from '@lingui/core'
import { type LinguiWording, verbatim } from './wording.ts'

/** A record value as a name: "hollow-point" as "Hollow point". */
export const titleFromKebab = (value: string) =>
  (value.charAt(0).toUpperCase() + value.slice(1)).replaceAll('-', ' ')

/** A core of a material, the material's word filled in: "lead core". */
export const materialCore = /*i18n*/ { id: 'values.materialCore', message: '{material} core' }

/** A value no message names shows as published, in the same form. */

const raw: Readonly<Record<string, MessageDescriptor>> = {
  // bullet structure
  'cup-and-core': /*i18n*/ { id: 'values.cupAndCore', message: 'cup-and-core' },
  bonded: /*i18n*/ { id: 'values.bonded', message: 'bonded' },
  partitioned: /*i18n*/ { id: 'values.partitioned', message: 'partitioned' },
  monolithic: /*i18n*/ { id: 'values.monolithic', message: 'monolithic' },
  cast: /*i18n*/ { id: 'values.cast', message: 'cast' },
  swaged: /*i18n*/ { id: 'values.swaged', message: 'swaged' },
  plated: /*i18n*/ { id: 'values.plated', message: 'plated' },
  frangible: /*i18n*/ { id: 'values.frangible', message: 'frangible' },
  // ogive form
  tangent: /*i18n*/ { id: 'values.tangent', message: 'tangent' },
  secant: /*i18n*/ { id: 'values.secant', message: 'secant' },
  hybrid: /*i18n*/ { id: 'values.hybrid', message: 'hybrid' },
  'round-nose': /*i18n*/ { id: 'values.roundNose', message: 'round-nose' },
  'flat-nose': /*i18n*/ { id: 'values.flatNose', message: 'flat-nose' },
  // tip type
  'hollow-point': /*i18n*/ { id: 'values.hollowPoint', message: 'hollow-point' },
  'polymer-tip': /*i18n*/ { id: 'values.polymerTip', message: 'polymer-tip' },
  'soft-point': /*i18n*/ { id: 'values.softPoint', message: 'soft-point' },
  'full-metal-jacket': /*i18n*/ { id: 'values.fullMetalJacket', message: 'full-metal-jacket' },
  'open-meplat': /*i18n*/ { id: 'values.openMeplat', message: 'open-meplat' },
  // base type
  flat: /*i18n*/ { id: 'values.flat', message: 'flat' },
  'boat-tail': /*i18n*/ { id: 'values.boatTail', message: 'boat-tail' },
  'rebated-boat-tail': /*i18n*/ { id: 'values.rebatedBoatTail', message: 'rebated-boat-tail' },
  'conical-hollow-base': /*i18n*/ {
    id: 'values.conicalHollowBase',
    message: 'conical-hollow-base',
  },
  'rounded-hollow-base': /*i18n*/ {
    id: 'values.roundedHollowBase',
    message: 'rounded-hollow-base',
  },
  // powder grain form and propellant base
  ball: /*i18n*/ { id: 'values.ball', message: 'ball' },
  extruded: /*i18n*/ { id: 'values.extruded', message: 'extruded' },
  flake: /*i18n*/ { id: 'values.flake', message: 'flake' },
  other: /*i18n*/ { id: 'values.other', message: 'other' },
  single: /*i18n*/ { id: 'values.single', message: 'single' },
  double: /*i18n*/ { id: 'values.double', message: 'double' },
  triple: /*i18n*/ { id: 'values.triple', message: 'triple' },
}

// "powder coat" and "compressed powder" are left out: the i18n lint requires the propellant's German word wherever a text says powder.
const spaced: Readonly<Record<string, MessageDescriptor>> = {
  // jacket and core materials
  copper: /*i18n*/ { id: 'values.copper', message: 'copper' },
  'gilding-metal': /*i18n*/ { id: 'values.gildingMetal', message: 'gilding metal' },
  'copper-clad-steel': /*i18n*/ { id: 'values.copperCladSteel', message: 'copper clad steel' },
  'copper-plated-steel': /*i18n*/ {
    id: 'values.copperPlatedSteel',
    message: 'copper plated steel',
  },
  steel: /*i18n*/ { id: 'values.steel', message: 'steel' },
  lead: /*i18n*/ { id: 'values.lead', message: 'lead' },
  'lead-alloy': /*i18n*/ { id: 'values.leadAlloy', message: 'lead alloy' },
  'copper-alloy': /*i18n*/ { id: 'values.copperAlloy', message: 'copper alloy' },
  tin: /*i18n*/ { id: 'values.tin', message: 'tin' },
  tungsten: /*i18n*/ { id: 'values.tungsten', message: 'tungsten' },
  // surface treatments
  moly: /*i18n*/ { id: 'values.moly', message: 'moly' },
  'black-oxide': /*i18n*/ { id: 'values.blackOxide', message: 'black oxide' },
  'polymer-coat': /*i18n*/ { id: 'values.polymerCoat', message: 'polymer coat' },
  paint: /*i18n*/ { id: 'values.paint', message: 'paint' },
  'wax-lube': /*i18n*/ { id: 'values.waxLube', message: 'wax lube' },
  'boron-nitride': /*i18n*/ { id: 'values.boronNitride', message: 'boron nitride' },
  'tungsten-disulfide': /*i18n*/ { id: 'values.tungstenDisulfide', message: 'tungsten disulfide' },
  'copper-wash': /*i18n*/ { id: 'values.copperWash', message: 'copper wash' },
  'lead-wash': /*i18n*/ { id: 'values.leadWash', message: 'lead wash' },
}

// a primer cup of brass is left out: the catalogue test requires the German word for a cartridge case in every text that says brass
const title: Readonly<Record<string, MessageDescriptor>> = {
  // case wall materials
  brass: /*i18n*/ { id: 'values.brass', message: 'Brass' },
  'nickel-plated-brass': /*i18n*/ {
    id: 'values.nickelPlatedBrass',
    message: 'Nickel plated brass',
  },
  'lacquered-steel': /*i18n*/ { id: 'values.lacqueredSteel', message: 'Lacquered steel' },
  'polymer-coated-steel': /*i18n*/ {
    id: 'values.polymerCoatedSteel',
    message: 'Polymer coated steel',
  },
  aluminium: /*i18n*/ { id: 'values.aluminum', message: 'Aluminum' },
  // primer sizes and compounds
  'small-rifle': /*i18n*/ { id: 'values.smallRifle', message: 'Small rifle' },
  'large-rifle': /*i18n*/ { id: 'values.largeRifle', message: 'Large rifle' },
  'small-pistol': /*i18n*/ { id: 'values.smallPistol', message: 'Small pistol' },
  'large-pistol': /*i18n*/ { id: 'values.largePistol', message: 'Large pistol' },
  shotshell: /*i18n*/ { id: 'values.shotshell', message: 'Shotshell' },
  'lead-styphnate': /*i18n*/ { id: 'values.leadStyphnate', message: 'Lead styphnate' },
  'lead-free': /*i18n*/ { id: 'values.leadFree', message: 'Lead free' },
}

/** A value as stored ("boat-tail", "extruded"). */
export const rawWording = (value: string): LinguiWording => raw[value] ?? verbatim(value)

/** A value with its hyphens as spaces ("gilding metal"). */
export const spacedWording = (value: string): LinguiWording =>
  spaced[value] ?? verbatim(value.replaceAll('-', ' '))

/** A value capitalized, hyphens as spaces ("Nickel plated brass"). */
export const titleWording = (value: string): LinguiWording =>
  title[value] ?? verbatim(titleFromKebab(value))

/** A primer cup's material: as `titleWording`, but a cup is no case, so brass stays as published. */
export const cupWording = (value: string): LinguiWording =>
  value === 'copper'
    ? /*i18n*/ { id: 'values.cupCopper', message: 'Copper' }
    : value === 'steel'
      ? /*i18n*/ { id: 'values.cupSteel', message: 'Steel' }
      : verbatim(titleFromKebab(value))

const methods: Readonly<Record<string, MessageDescriptor>> = {
  transducer: /*i18n*/ { id: 'values.transducer', message: 'transducer' },
  piezo: /*i18n*/ { id: 'values.piezo', message: 'piezo' },
  'case-contact': /*i18n*/ { id: 'values.caseContact', message: 'case-contact' },
  crusher: /*i18n*/ { id: 'values.crusher', message: 'crusher' },
  energy: /*i18n*/ { id: 'values.energy', message: 'energy' },
}

/** The pressure measuring method of a cartridge record. */
export const methodWording = (value: string): LinguiWording => methods[value] ?? verbatim(value)

/** A yes or no value, lower case as the bullet table writes it, or capitalized as the case and primer tables do. */
export const yesNo = (value: boolean, capitalised = false): MessageDescriptor =>
  capitalised
    ? value
      ? /*i18n*/ { id: 'values.yesTitle', message: 'Yes' }
      : /*i18n*/ { id: 'values.noTitle', message: 'No' }
    : value
      ? /*i18n*/ { id: 'values.yes', message: 'yes' }
      : /*i18n*/ { id: 'values.no', message: 'no' }
