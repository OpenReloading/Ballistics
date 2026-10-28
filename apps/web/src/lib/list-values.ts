/** The words of the record values that the lists show in their cells: a value the map lacks is shown as the record gives it. */
import { type Message, msg, type Translator } from '../i18n/translate.ts'
import { titleFromKebab } from './record-fields.ts'

/** The value as a name ("nickel-plated-brass" as "Nickel plated brass"), keyed as it reads. */
const names: Record<string, Message> = {
  Brass: msg('Brass'),
  'Nickel plated brass': msg('Nickel plated brass'),
  'Lacquered steel': msg('Lacquered steel'),
  'Polymer coated steel': msg('Polymer coated steel'),
  Aluminium: msg('Aluminium'),
  'Small rifle': msg('Small rifle'),
  'Large rifle': msg('Large rifle'),
  'Small pistol': msg('Small pistol'),
  'Large pistol': msg('Large pistol'),
  Shotshell: msg('Shotshell'),
  'Lead styphnate': msg('Lead styphnate'),
  'Lead free': msg('Lead free'),
  'Air rifle': msg('Air rifle'),
  'Air pistol': msg('Air pistol'),
  Rifle: msg('Rifle'),
  'Precision rifle': msg('Precision rifle'),
  'Service rifle': msg('Service rifle'),
  'Lever action': msg('Lever action'),
  Carbine: msg('Carbine'),
  Pistol: msg('Pistol'),
  'Service pistol': msg('Service pistol'),
  Revolver: msg('Revolver'),
  'Muzzle loader': msg('Muzzle loader'),
}

/** A record value written with hyphens as the lists show it, in the language of `t`. */
export function kebabValue(t: Translator['t'], value: string) {
  const text = titleFromKebab(value)
  const known = names[text]
  return known ? t(known) : text
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
