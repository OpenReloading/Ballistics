import type { LoadTables, Powder, Source } from '@rangefoundry/schema'

export type { LoadTable, LoadTables } from '@rangefoundry/schema'

/** Whether `loadTables` lists a table with the source's title, URL and retrieval date. */
function isListedLoadTable(source: Source, loadTables: LoadTables) {
  const table = Object.values(loadTables).find((t) => t.title === source.title)
  return !!table && table.url === source.url && table.retrieved === source.retrieved
}

const isInterior = (f: string) => f === 'interior' || f.startsWith('interior.')

/** The findings of one source that supports `interior` or is fitted, of `powder`. */
function checkInteriorSource(
  s: Source,
  at: string,
  kind: string,
  { powder, loadTables }: { powder: Powder; loadTables: LoadTables | undefined },
): string[] {
  const errors: string[] = []
  if (kind !== 'fitted') errors.push(`${at} supports interior but is not fitted`)
  else if (!s.fields?.every(isInterior))
    errors.push(`${at}: a fitted source supports only interior`)
  else if (!powder.interior) errors.push(`${at}: fitted source without interior`)
  if (kind !== 'fitted') return errors
  if (!loadTables) return [...errors, ...publicFitFindings(s, at)]
  if (!isListedLoadTable(s, loadTables)) errors.push(`${at} is not a listed load table`)
  if (!s.run?.report) errors.push(`${at} names no fit run (version, report)`)
  return errors
}

/** The findings of the fitted source `s` in a records root without load tables (the public catalog): it names its document, the retrieval date and the model version, and no fit report. */
function publicFitFindings(s: Source, at: string): string[] {
  const errors: string[] = []
  if (s.title === undefined) errors.push(`${at} names no title`)
  if (s.retrieved === undefined) errors.push(`${at} names no retrieval date`)
  if (!s.run) errors.push(`${at} names no fit run (version)`)
  if (s.run?.report !== undefined) errors.push(`${at} names a fit report, which stays private`)
  return errors
}

/**
 * Provenance gate of the powder model. A source that is `fitted`, or supports `interior` of a
 * powder that has one, must be a `fitted` source whose `fields` list only `interior`, on a powder
 * with `interior`. With `loadTables` (the records root has a `load-tables.json`) it must name a
 * listed load table (title, URL, retrieval date) and the fit run (model version, report); without
 * them (the public catalog) a title, a retrieval date and the model version of the fit run, and no
 * report. A source under an open license (`origin: public` with a `license`) is exempt. A powder
 * with `interior` needs at least one fitted source. Returns one message per broken rule.
 */
export function checkFittedSources(powder: Powder, loadTables: LoadTables | undefined): string[] {
  const { provenance } = powder
  if (!provenance) return powder.interior ? ['interior without a fitted source'] : []
  const errors: string[] = []
  let fitted = 0
  provenance.sources.forEach((s, i) => {
    const kind = s.kind ?? provenance.kind
    const covers = !s.fields || s.fields.some(isInterior)
    // a source under an open license needs no listed manufacturer load table (the demo powder)
    if (s.origin === 'public' && s.license) {
      if (kind === 'fitted') fitted++
      return
    }
    if (kind !== 'fitted' && !(covers && powder.interior)) return
    if (kind === 'fitted') fitted++
    errors.push(
      ...checkInteriorSource(s, `source ${i} ("${s.title}")`, kind, { powder, loadTables }),
    )
  })
  if (powder.interior && fitted === 0) errors.push('interior without a fitted source')
  return errors
}
