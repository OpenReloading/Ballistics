import { type SourceRecord, sourceReference } from '@open-reloading/schema'

/** The source records by id, the ids records cite, and the files that embed each other source. */
export type SourceIndex = {
  byId: Map<string, SourceRecord>
  cited: Set<string>
  embedded: Map<string, Set<string>>
}

/** An index of `records` with nothing cited yet. */
export function sourceIndex(records: SourceRecord[]): SourceIndex {
  return { byId: new Map(records.map((s) => [s.id, s])), cited: new Set(), embedded: new Map() }
}

/** The file being read, where its errors go, and the source records. */
type Resolving = { index: SourceIndex; file: string; errors: string[] }

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null

/** The source record `id`, marked cited, or undefined with an error. */
function cite(id: string, index: SourceIndex, where: string, errors: string[]) {
  const record = index.byId.get(id)
  if (!record) errors.push(`${where}: unknown source "${id}"`)
  else index.cited.add(id)
  return record
}

/** A reference resolved to the source record with this record's parts, or an embedded source noted. */
function resolveSource(entry: unknown, at: string, { index, file, errors }: Resolving) {
  if (!isObject(entry)) return entry
  if (!('source' in entry)) {
    const key =
      typeof entry.sha256 === 'string' ? entry.sha256 : `${entry.title} ${entry.url ?? ''}`
    index.embedded.set(key, (index.embedded.get(key) ?? new Set()).add(file))
    return entry
  }
  const parsed = sourceReference.safeParse(entry)
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      errors.push(
        `${file}: ${at}${issue.path.length ? `.${issue.path.join('.')}` : ''}: ${issue.message}`,
      )
    }
    return entry
  }
  const { source: id, note, ...own } = parsed.data
  const record = cite(id, index, `${file}: ${at}`, errors)
  if (!record) return entry
  const { id: _id, note: shared, ...rest } = record
  const notes = [note, shared].filter(Boolean).join(' ')
  return { ...rest, ...own, ...(notes && { note: notes }) }
}

/** The title, edition, URL and SHA-256 of a source record that is a rule book. */
const ruleBookOf = ({ title, edition, url, sha256 }: SourceRecord) => ({
  title,
  edition,
  url,
  sha256,
})

/**
 * The record `json` of `file` with each source reference of its provenance resolved, each rule
 * book of a federation (a source record id) resolved to title, edition, URL and SHA-256, and the
 * rule book of an event type to title, edition, publisher, URL and SHA-256.
 */
export function resolveRecord(json: unknown, index: SourceIndex, file: string, errors: string[]) {
  if (!isObject(json)) return json
  const out = { ...json }
  const provenance = json.provenance
  if (isObject(provenance) && Array.isArray(provenance.sources)) {
    out.provenance = {
      ...provenance,
      sources: provenance.sources.map((s, i) =>
        resolveSource(s, `provenance.sources.${i}`, { index, file, errors }),
      ),
    }
  }
  if (Array.isArray(json.ruleBooks)) {
    out.ruleBooks = json.ruleBooks.map((id, i) => {
      const at = `${file}: ruleBooks.${i}`
      if (typeof id !== 'string') {
        errors.push(`${at}: name a source record by id`)
        return id
      }
      const record = cite(id, index, at, errors)
      return record && ruleBookOf(record)
    })
  }
  if (typeof json.ruleBook === 'string') {
    const at = `${file}: ruleBook`
    const record = cite(json.ruleBook, index, at, errors)
    if (record && !record.publisher) errors.push(`${at}: source "${record.id}" names no publisher`)
    out.ruleBook = record && { ...ruleBookOf(record), publisher: record.publisher }
  }
  return out
}

/** Each source record is cited and has a SHA-256 no other one has; returns them by SHA-256. */
function checkSourceRecords(index: SourceIndex, errors: string[]) {
  const bySha = new Map<string, string>()
  for (const s of index.byId.values()) {
    const where = `sources/${s.id}.json`
    if (!index.cited.has(s.id)) errors.push(`${where}: no record cites it`)
    if (!s.sha256) continue
    const other = bySha.get(s.sha256)
    if (other) errors.push(`${where}: same sha256 as sources/${other}.json`)
    else bySha.set(s.sha256, s.id)
  }
  return bySha
}

/**
 * Each source is stored one way: a source record that some record cites, with a SHA-256 no other
 * source record has, or embedded in one record only and not also a source record.
 */
export function checkSources(index: SourceIndex, errors: string[]) {
  const bySha = checkSourceRecords(index, errors)
  for (const [key, files] of index.embedded) {
    const record = bySha.get(key)
    const [first, ...others] = [...files]
    if (record)
      for (const file of files) errors.push(`${file}: cite source record "${record}" by id`)
    else if (others.length) {
      errors.push(`${first}: source also in ${others.join(', ')}, make it a source record`)
    }
  }
}
