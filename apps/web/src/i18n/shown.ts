let shown = 'en'

/** The language numbers, dates and names are written in: the language shown, English until another has loaded. */
export const shownLanguage = () => shown

/** Sets the language written in; the language module calls it when the language shown changes. */
export function setShownLanguage(language: string) {
  shown = language
}
