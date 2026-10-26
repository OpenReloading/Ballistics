import type { Finding } from './plausibility.ts'
import type { Bundle } from './records.ts'

/** A finding with the record file it was found in (`<dir>/<id>.json`). */
export type LocatedFinding = Finding & { file: string }

type Named = { file: string; scope: string; names: string[] }

/**
 * Lower-case letters and digits only, accents removed: `P-140` and `p140` are one name. A decimal
 * point between digits stays, so `6.5x55` and `65x55` differ.
 */
export function normaliseName(name: string) {
  return name
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9.]|(?<!\d)\.|\.(?!\d)/g, '')
}

type Seen = { exact: Map<string, string>; normalised: Map<string, string> }

/** The finding for one name of a record, if an earlier record has it; adds the name to `seen`. */
function duplicateOf(
  seen: Seen,
  { file, scope }: Named,
  name: string,
  reported: Set<string>,
): LocatedFinding | undefined {
  const norm = normaliseName(name)
  const same = seen.exact.get(`${scope}\n${name}`)
  const similar = seen.normalised.get(`${scope}\n${norm}`)
  let found: LocatedFinding | undefined
  if (same && same !== file) {
    found = {
      file,
      finding: `duplicate-name:${name}`,
      message: `"${name}" is also a name of ${same}`,
    }
    reported.add(norm)
  } else if (norm !== '' && similar && similar !== file && !reported.has(norm)) {
    found = {
      file,
      finding: `duplicate-normalised-name:${norm}`,
      message: `"${name}" normalises like a name of ${similar}`,
    }
    reported.add(norm)
  }
  if (!same) seen.exact.set(`${scope}\n${name}`, file)
  if (!similar && norm !== '') seen.normalised.set(`${scope}\n${norm}`, file)
  return found
}

/** Reports each record that shares a name with an earlier record (by file name, code-unit order as `readKind` reads them) of its kind and scope. */
function duplicates(records: Named[]): LocatedFinding[] {
  const findings: LocatedFinding[] = []
  const seen: Seen = { exact: new Map(), normalised: new Map() }
  for (const record of [...records].sort((a, b) => (a.file < b.file ? -1 : 1))) {
    const reported = new Set<string>()
    for (const name of new Set(record.names)) {
      const found = duplicateOf(seen, record, name, reported)
      if (found) findings.push(found)
    }
  }
  return findings
}

/**
 * Reports records that share a name, exactly or after `normaliseName`, with an earlier record of
 * their kind and scope. Scopes: none for cartridges, manufacturers and powder aliases, manufacturer id
 * for powders and bullets, manufacturer and cartridge for cases, the report for range
 * records, federation id for target faces.
 */
export function checkNames(
  bundle: Pick<
    Bundle,
    | 'cartridges'
    | 'manufacturers'
    | 'powders'
    | 'bullets'
    | 'cases'
    | 'rangeFirings'
    | 'targetFaces'
  >,
): LocatedFinding[] {
  const at = (dir: string, id: string) => `${dir}/${id}.json`
  return [
    ...duplicates(
      bundle.cartridges.map((c) => ({
        file: at('cartridges', c.id),
        scope: '',
        names: [c.name, ...(c.aliases ?? [])],
      })),
    ),
    ...duplicates(
      bundle.manufacturers.map((m) => ({
        file: at('manufacturers', m.id),
        scope: '',
        names: [m.name, ...(m.aliases ?? [])],
      })),
    ),
    ...duplicates(
      bundle.powders.map((p) => ({
        file: at('powders', p.id),
        scope: p.manufacturer,
        names: [p.name],
      })),
    ),
    // An alias names a brand and name of another manufacturer, so aliases are compared with aliases only.
    ...duplicates(
      bundle.powders.map((p) => ({ file: at('powders', p.id), scope: '', names: p.aliases ?? [] })),
    ),
    ...duplicates(
      bundle.bullets.map((b) => ({
        file: at('bullets', b.id),
        scope: b.manufacturer,
        names: [b.name],
      })),
    ),
    // A case is named per cartridge, as the same product line serves several.
    ...duplicates(
      bundle.cases.map((c) => ({
        file: at('cases', c.id),
        scope: `${c.manufacturer} ${c.cartridge}`,
        names: [c.name],
      })),
    ),
    // One projectile may appear in several reports.
    ...duplicates(
      bundle.rangeFirings.flatMap((r) => {
        const [source] = r.provenance.sources
        if (!source) return []
        return [
          {
            file: at('range', r.id),
            scope: source.sha256 ?? source.url ?? source.title,
            names: [r.projectile],
          },
        ]
      }),
    ),
    ...duplicates(
      bundle.targetFaces.map((f) => ({
        file: at('target-faces', f.id),
        scope: f.federation ?? '',
        names: [f.name],
      })),
    ),
  ]
}
