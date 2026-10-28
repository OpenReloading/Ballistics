import { type Message, msg, type Translator } from '../i18n/translate.ts'

type Translate = Translator['t']

/** A stored kebab-case value as a name: "air-rifle" as "Air rifle". */
const kebabName = (value: string) =>
  (value.charAt(0).toUpperCase() + value.slice(1)).replaceAll('-', ' ')

/** The discipline categories of the schema as words; a value the map lacks is shown as its name. */
const categories: Record<string, Message> = {
  'air-rifle': msg('Air rifle'),
  'air-pistol': msg('Air pistol'),
  rifle: msg('Rifle'),
  'precision-rifle': msg('Precision rifle'),
  'service-rifle': msg('Service rifle'),
  'lever-action': msg('Lever action'),
  carbine: msg('Carbine'),
  pistol: msg('Pistol'),
  'service-pistol': msg('Service pistol'),
  revolver: msg('Revolver'),
  'muzzle-loader': msg('Muzzle loader'),
}

/** A discipline's category in the language of `t`. */
export const categoryWord = (t: Translate, value: string) => {
  const word = categories[value]
  return word ? t(word) : kebabName(value)
}

/** The printed colours of a ring zone or line. */
const colours: Record<string, Message> = {
  black: msg('black'),
  white: msg('white'),
  grey: msg('grey'),
  red: msg('red'),
  orange: msg('orange'),
  yellow: msg('yellow'),
  green: msg('green'),
  blue: msg('blue'),
  brown: msg('brown'),
}

/** A ring colour in the language of `t`. */
export const colourWord = (t: Translate, value: string) => {
  const word = colours[value]
  return word ? t(word) : value
}
