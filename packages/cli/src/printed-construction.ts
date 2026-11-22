const plated = /\b(?:electro-?)?plat(?:ed|ing)\b|\bcopper[\s-]washed\b|\bverkupfert/

const monolithic =
  /\bmono[\s-]?(?:lith|metal)\w*|\bhomogen\w*|\bsolid[\s-](?:copper|brass)\b|\b(?:copper|brass)[\s-]solid\b|\ball[\s-]copper\b|\blathe[\s-]turned\b|\bvoll(?:kupfer|messing)/

// a plated steel jacket and a solid copper jacket are jacketed bullets
const steel = /\bsteel\b|stahl/
const jacket = /jacket|mantel/

/** The structure the construction words of a printed bullet text name: `plated` (plated, plating, electroplated, copper washed, verkupfert; not with steel named) or `monolithic` (monolithic, mono-metal, homogeneous, solid copper or brass in either order, all copper, lathe turned, Vollkupfer, Vollmessing; not with a jacket named); undefined for a text that names neither or both. Reads no maker or product name. */
export function printedConstruction(text: string): 'plated' | 'monolithic' | undefined {
  const lower = text.toLowerCase()
  const isPlated = plated.test(lower) && !steel.test(lower)
  const isMonolithic = monolithic.test(lower) && !jacket.test(lower)
  if (isPlated === isMonolithic) return undefined
  return isPlated ? 'plated' : 'monolithic'
}
