/**
 * `npm audit` at `--audit-level=high` with an allowlist: fails on every high or critical advisory
 * except those in `allowed`. An allowed advisory fails again once npm reports a fix for its
 * package, and an allowed advisory npm no longer reports fails too, so the list cannot go stale.
 */
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

/** Advisories without a fix, by GHSA id, with why they cannot reach users. */
export const allowed: Record<string, string> = {
  'GHSA-vfj7-8cjw-p6xm':
    'braces, every version: only the docs site build (Docusaurus, through micromatch and chokidar) uses it, on patterns from this repository',
}

/** The parts of an `npm audit --json` report the check reads. */
export interface AuditReport {
  vulnerabilities: Record<
    string,
    {
      via: (string | { name: string; title: string; url: string; severity: string })[]
      fixAvailable: unknown
    }
  >
}

type Advisory = Exclude<AuditReport['vulnerabilities'][string]['via'][number], string>

const idOf = (a: Advisory) => a.url.split('/').pop() ?? a.url

/** Why one high or critical advisory fails the check, undefined when it passes. */
function problemOf(a: Advisory, report: AuditReport, allow: Record<string, string>) {
  const id = idOf(a)
  if (!(id in allow)) return `${id} (${a.severity}, ${a.name}): ${a.title}`
  if (report.vulnerabilities[a.name]?.fixAvailable !== false)
    return `${id} (${a.name}): a fix is available, update and remove it from the allowlist`
}

/** One line per advisory that fails the check, empty when it passes. */
export function problems(report: AuditReport, allow: Record<string, string> = allowed) {
  const found = Object.values(report.vulnerabilities)
    .flatMap((v) => v.via)
    .filter((v): v is Advisory => typeof v !== 'string')
    .filter((a) => a.severity === 'high' || a.severity === 'critical')
  const seen = new Set(found.map(idOf))
  const stale = Object.keys(allow)
    .filter((id) => !seen.has(id))
    .map((id) => `${id}: no longer reported, remove it from the allowlist`)
  const failing = found.map((a) => problemOf(a, report, allow)).filter((p) => p !== undefined)
  return [...new Set([...failing, ...stale])]
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  // npm audit exits 1 whenever it finds anything, so its JSON decides instead
  const run = spawnSync('npm', ['audit', '--json'], { encoding: 'utf8', maxBuffer: 64 << 20 })
  const report = JSON.parse(run.stdout) as AuditReport
  if (!report.vulnerabilities) {
    console.error(run.stdout || run.stderr)
    process.exit(1)
  }
  const found = problems(report)
  for (const line of found) console.error(line)
  if (found.length) process.exit(1)
  console.log(
    `npm audit: no high or critical advisory outside the allowlist (${Object.keys(allowed).join(', ')})`,
  )
}
