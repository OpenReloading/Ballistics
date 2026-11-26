import type { I18n, MessageDescriptor } from '@lingui/core'
import { loadEnglish } from '../i18n/lingui.ts'
import englishMessages from '../locales/en/lib/face-words.json' with { type: 'json' }

loadEnglish(englishMessages)

/** The printed colors of a ring zone or line. */
const colours: Record<string, MessageDescriptor> = {
  black: /*i18n*/ { id: 'targets.color.black', message: 'black' },
  white: /*i18n*/ { id: 'targets.color.white', message: 'white' },
  grey: /*i18n*/ { id: 'targets.color.gray', message: 'grey' },
  red: /*i18n*/ { id: 'targets.color.red', message: 'red' },
  orange: /*i18n*/ { id: 'targets.color.orange', message: 'orange' },
  yellow: /*i18n*/ { id: 'targets.color.yellow', message: 'yellow' },
  green: /*i18n*/ { id: 'targets.color.green', message: 'green' },
  blue: /*i18n*/ { id: 'targets.color.blue', message: 'blue' },
  brown: /*i18n*/ { id: 'targets.color.brown', message: 'brown' },
}

/** A ring color in the language of `i18n`. */
export const colourWord = (i18n: I18n, value: string) => {
  const word = colours[value]
  return word ? i18n._(word) : value
}
