import { shownLanguage } from '../i18n/shown.ts'

/** ISO 3166-1 alpha-2 codes by the lower-cased name CIP sheets print as the country of origin; a record may name several. */
const codes: Record<string, string> = {
  austria: 'AT',
  belgium: 'BE',
  canada: 'CA',
  'czech republic': 'CZ',
  finland: 'FI',
  fr: 'FR',
  france: 'FR',
  germany: 'DE',
  israel: 'IL',
  it: 'IT',
  italy: 'IT',
  japan: 'JP',
  norway: 'NO',
  portugal: 'PT',
  'russian federation': 'RU',
  slovenia: 'SI',
  sweden: 'SE',
  switzerland: 'CH',
  turkey: 'TR',
  'united kingdom': 'GB',
  'united states': 'US',
  us: 'US',
}

/** Names for records that print a code instead of the country. */
const names: Record<string, string> = { fr: 'France', it: 'Italy', us: 'United States' }

/** Each word upper case first ("United states" as the records print it), "and" kept, the rest as given. */
const display = (name: string) =>
  name.replace(/\p{L}+/gu, (w) => (w === 'and' ? w : w.charAt(0).toUpperCase() + w.slice(1)))

/** The record's countries, each with its flag code when it has one. */
export function parseCountries(text: string) {
  return text
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => ({
      name: names[part.toLowerCase()] ?? display(part),
      code: codes[part.toLowerCase()] as string | undefined,
    }))
}

const regionNames = new Map<string, Intl.DisplayNames>()

/** The names of the regions in `language`, from `Intl`. */
function regions(language: string) {
  let names = regionNames.get(language)
  if (!names) {
    names = new Intl.DisplayNames(language, { type: 'region' })
    regionNames.set(language, names)
  }
  return names
}

/** Other languages name the code through `Intl`; English keeps the record's own name. */
export const countryName = (name: string, code: string | undefined, language = shownLanguage()) =>
  language === 'en' || !code ? name : (regions(language).of(code) ?? name)

/** The country of a bullet or powder record's ISO 3166-1 alpha-2 code, as `parseCountries` returns it. */
export const countryOf = (code: string) => ({ name: regions('en').of(code) ?? code, code })
