import type { LoadTables, Powder, Source } from '@open-reloading/schema'

export type { LoadTable, LoadTables } from '@open-reloading/schema'

/** Whether `loadTables` lists a table with the source's title, URL and retrieval date. */
function isListedLoadTable(source: Source, loadTables: LoadTables) {
  const table = Object.values(loadTables).find((t) => t.title === source.title)
  return !!table && table.url === source.url && table.retrieved === source.retrieved
}

const isInterior = (f: string) => f === 'interior' || f.startsWith('interior.')

/** The findings of one source that supports `interior` or is fitted. */
function checkInteriorSource(
  s: Source,
  at: string,
  kind: string,
  powder: Powder,
  loadTables: LoadTables,
  errors: string[],
) {
  if (kind !== 'fitted') errors.push(`${at} supports interior but is not fitted`)
  else if (!s.fields?.every(isInterior))
    errors.push(`${at}: a fitted source supports only interior`)
  else if (!powder.interior) errors.push(`${at}: fitted source without interior`)
  if (kind !== 'fitted') return
  if (!isListedLoadTable(s, loadTables)) errors.push(`${at} is not a listed load table`)
  if (!s.run) errors.push(`${at} names no fit run (version, report)`)
}

/**
 * Provenance gate of the powder model. A source that is `fitted`, or supports `interior` of a
 * powder that has one, must be a `fitted` source whose `fields` list only `interior`, on a powder
 * with `interior`, and must name a listed load table (title, URL, retrieval date) and the fit run
 * (model version, report). A source under an open license (`origin: public` with a `license`) is
 * exempt. A powder with `interior` needs at least one fitted source. Returns one message per broken
 * rule.
 */
export function checkFittedSources(powder: Powder, loadTables: LoadTables): string[] {
  const errors: string[] = []
  let fitted = 0
  powder.provenance.sources.forEach((s, i) => {
    const kind = s.kind ?? powder.provenance.kind
    const covers = !s.fields || s.fields.some(isInterior)
    // a source under an open license needs no listed manufacturer load table (the demo powder)
    if (s.origin === 'public' && s.license) {
      if (kind === 'fitted') fitted++
      return
    }
    if (kind !== 'fitted' && !(covers && powder.interior)) return
    if (kind === 'fitted') fitted++
    checkInteriorSource(s, `source ${i} ("${s.title}")`, kind, powder, loadTables, errors)
  })
  if (powder.interior && fitted === 0) errors.push('interior without a fitted source')
  return errors
}
