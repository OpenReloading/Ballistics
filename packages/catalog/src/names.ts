import type { Finding } from './plausibility.ts'
import type { Bundle } from './records.ts'

/** A finding with the record file it was found in (`<dir>/<id>.json`). */
export type LocatedFinding = Finding & { file: string }

type Named = { file: string; scope: string; names: string[] }

/** Lower-case letters and digits only, accents removed, so `P-140` and `p140` are one name; a decimal point between digits stays, so `6.5x55` and `65x55` differ. */
export function normaliseName(name: string): string {
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
  for (const record of records.toSorted((a, b) => (a.file < b.file ? -1 : 1))) {
    const reported = new Set<string>()
    for (const name of new Set(record.names)) {
      const found = duplicateOf(seen, record, name, reported)
      if (found) findings.push(found)
    }
  }
  return findings
}

/** The record file of `id` in directory `dir`. */
const fileOf = (dir: string, id: string) => `${dir}/${id}.json`

/** The names of cartridges, manufacturers, powders, primers and bullets, one group per comparison. */
function componentNames(
  bundle: Pick<Bundle, 'cartridges' | 'manufacturers' | 'powders' | 'primers' | 'bullets'>,
): Named[][] {
  return [
    bundle.cartridges.map((c) => ({
      file: fileOf('cartridges', c.id),
      scope: '',
      names: [c.name, ...(c.aliases ?? [])],
    })),
    bundle.manufacturers.map((m) => ({
      file: fileOf('manufacturers', m.id),
      scope: '',
      names: [m.name, ...(m.aliases ?? [])],
    })),
    bundle.powders.map((p) => ({
      file: fileOf('powders', p.id),
      scope: p.manufacturer,
      names: [p.name],
    })),
    // An alias names a brand and name of another manufacturer, so aliases are compared with aliases only.
    bundle.powders.map((p) => ({
      file: fileOf('powders', p.id),
      scope: '',
      names: p.aliases ?? [],
    })),
    bundle.primers.map((p) => ({
      file: fileOf('primers', p.id),
      scope: p.manufacturer,
      names: [p.name],
    })),
    bundle.bullets.map((b) => ({
      file: fileOf('bullets', b.id),
      scope: b.manufacturer,
      names: [b.name],
    })),
  ]
}

/** The names of cases, range records and target faces, one group per comparison. */
function otherNames(bundle: Pick<Bundle, 'cases' | 'rangeFirings' | 'targetFaces'>): Named[][] {
  return [
    // A case is named per cartridge, as the same product line serves several.
    bundle.cases.map((c) => ({
      file: fileOf('cases', c.id),
      scope: `${c.manufacturer} ${c.cartridge}`,
      names: [c.name],
    })),
    // One projectile may appear in several reports.
    bundle.rangeFirings.flatMap((r) => {
      const [source] = r.provenance.sources
      if (!source) return []
      return [
        {
          file: fileOf('range', r.id),
          scope: source.sha256 ?? source.url ?? source.title ?? r.id,
          names: [r.projectile],
        },
      ]
    }),
    bundle.targetFaces.map((f) => ({
      file: fileOf('target-faces', f.id),
      scope: f.federation ?? '',
      names: [f.name],
    })),
  ]
}

/** Exactly or after `normaliseName`, against an earlier record of their kind and scope: none for cartridges, manufacturers and powder aliases, the manufacturer id for powders, primers and bullets, manufacturer and cartridge for cases, the report for range records, the federation id for target faces. */
export function checkNames(
  bundle: Pick<
    Bundle,
    | 'cartridges'
    | 'manufacturers'
    | 'powders'
    | 'primers'
    | 'bullets'
    | 'cases'
    | 'rangeFirings'
    | 'targetFaces'
  >,
): LocatedFinding[] {
  return [...componentNames(bundle), ...otherNames(bundle)].flatMap((group) => duplicates(group))
}
