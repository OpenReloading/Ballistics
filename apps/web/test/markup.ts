/** Until none is left (`pattern` a global regex), as one pass can join the text around a removed match into a new match. */
export function replaceUntilStable(markup: string, pattern: RegExp, by = ''): string {
  let text = markup
  let before: string
  do {
    before = text
    text = text.replace(pattern, by)
  } while (text !== before)
  return text
}
