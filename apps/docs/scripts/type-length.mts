/** Longer rendered types need a named type: TypeDoc prints inferred literals in full. */
export const maxTypeLength = 100

/** Is the rendered type of an exported variable or function too long to read in the docs? */
export const tooLong = (rendered: string) => rendered.length > maxTypeLength
