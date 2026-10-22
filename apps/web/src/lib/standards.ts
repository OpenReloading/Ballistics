/** Search option text: the standard right after the name, so a narrow list box clips aliases, not the standard. */
export function cartridgeOptionText(c: { name: string; aliases: string[] }) {
  return `${c.name}, CIP${c.aliases.length > 0 ? ` (${c.aliases.join(', ')})` : ''}`
}
