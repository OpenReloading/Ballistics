/** The words of the record values that the lists show in their cells: a value the map lacks is shown as the record gives it. */
import type { I18n, MessageDescriptor } from '@lingui/core'
import { type Message, msg, type Translator } from '../i18n/translate.ts'
import { titleFromKebab } from './record-fields.ts'

/** The value as a name ("nickel-plated-brass" as "Nickel plated brass"), keyed as it reads. */
const names: Record<string, MessageDescriptor> = {
  Brass: /*i18n*/ { id: 'values.brass', message: 'Brass' },
  'Nickel plated brass': /*i18n*/ {
    id: 'values.nickelPlatedBrass',
    message: 'Nickel plated brass',
  },
  'Lacquered steel': /*i18n*/ { id: 'values.lacqueredSteel', message: 'Lacquered steel' },
  'Polymer coated steel': /*i18n*/ {
    id: 'values.polymerCoatedSteel',
    message: 'Polymer coated steel',
  },
  Aluminium: /*i18n*/ { id: 'values.aluminum', message: 'Aluminum' },
  'Small rifle': /*i18n*/ { id: 'values.smallRifle', message: 'Small rifle' },
  'Large rifle': /*i18n*/ { id: 'values.largeRifle', message: 'Large rifle' },
  'Small pistol': /*i18n*/ { id: 'values.smallPistol', message: 'Small pistol' },
  'Large pistol': /*i18n*/ { id: 'values.largePistol', message: 'Large pistol' },
  Shotshell: /*i18n*/ { id: 'values.shotshell', message: 'Shotshell' },
  'Lead styphnate': /*i18n*/ { id: 'values.leadStyphnate', message: 'Lead styphnate' },
  'Lead free': /*i18n*/ { id: 'values.leadFree', message: 'Lead free' },
  'Air rifle': /*i18n*/ { id: 'values.airRifle', message: 'Air rifle' },
  'Air pistol': /*i18n*/ { id: 'values.airPistol', message: 'Air pistol' },
  Rifle: /*i18n*/ { id: 'values.rifle', message: 'Rifle' },
  'Precision rifle': /*i18n*/ { id: 'values.precisionRifle', message: 'Precision rifle' },
  'Service rifle': /*i18n*/ { id: 'values.serviceRifle', message: 'Service rifle' },
  'Lever action': /*i18n*/ { id: 'values.leverAction', message: 'Lever action' },
  Carbine: /*i18n*/ { id: 'values.carbine', message: 'Carbine' },
  Pistol: /*i18n*/ { id: 'values.pistol', message: 'Pistol' },
  'Service pistol': /*i18n*/ { id: 'values.servicePistol', message: 'Service pistol' },
  Revolver: /*i18n*/ { id: 'values.revolver', message: 'Revolver' },
  'Muzzle loader': /*i18n*/ { id: 'values.muzzleLoader', message: 'Muzzle loader' },
}

/** A record value written with hyphens as the lists show it, in the language of `i18n`. */
export function kebabValue(i18n: I18n, value: string) {
  const text = titleFromKebab(value)
  const known = names[text]
  return known ? i18n._(known) : text
}

const caseTypes: Record<string, Message> = {
  rimless: msg('rimless'),
  'semi-rimmed': msg('semi-rimmed'),
  rimmed: msg('rimmed'),
  rebated: msg('rebated'),
  belted: msg('belted'),
}

/** The rim form of a cartridge case ("rimless"). */
export const caseTypeText = (t: Translator['t'], type: string) => {
  const known = caseTypes[type]
  return known ? t(known) : type
}

/** A powder's grain form and propellant base as the lists show them. */
const grainForms: Record<string, Message> = {
  ball: msg('ball'),
  extruded: msg('extruded'),
  flake: msg('flake'),
  other: msg('other'),
}

const scopes: Record<string, Message> = {
  rifle: msg('Rifle'),
  handgun: msg('Handgun'),
  shotgun: msg('Shotgun'),
}

/** A use the maker states for a powder ("Rifle"). */
export const scopeText = (t: Translator['t'], scope: string) => {
  const known = scopes[scope]
  return known ? t(known) : scope
}

const bases: Record<string, Message> = {
  single: msg('single'),
  double: msg('double'),
  triple: msg('triple'),
}

const baseLines: Record<string, Message> = {
  single: msg('single base'),
  double: msg('double base'),
  triple: msg('triple base'),
}

/** The grain form of a powder ("ball"), as the record gives it for a value the map lacks. */
export const grainFormText = (t: Translator['t'], form: string) => {
  const known = grainForms[form]
  return known ? t(known) : form
}

/** The propellant base of a powder ("single"). */
export const baseText = (t: Translator['t'], base: string) => {
  const known = bases[base]
  return known ? t(known) : base
}

/** The propellant base as a phrase ("single base"). */
export const baseLine = (t: Translator['t'], base: string) => {
  const known = baseLines[base]
  return known ? t(known) : base
}
