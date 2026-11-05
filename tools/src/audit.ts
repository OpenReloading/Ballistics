/**
 * `pnpm audit` with an allowlist: fails on every high or critical advisory except those in
 * `allowed`. An allowed advisory fails again once a patched version exists, and an allowed
 * advisory pnpm no longer reports fails too, so the list cannot go stale.
 */
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { executable } from './executable.ts'

/** Advisories without a fix, by GHSA id, with why they cannot reach users. */
export const allowed: Record<string, string> = {}

/** The parts of a `pnpm audit --json` report the check reads. */
export interface AuditReport {
  advisories: Record<
    string,
    {
      github_advisory_id: string
      module_name: string
      severity: string
      title: string
      /** `<0.0.0` when no version has the fix. */
      patched_versions: string
    }
  >
}

type Advisory = AuditReport['advisories'][string]

/** Why one high or critical advisory fails the check, undefined when it passes. */
function problemOf(a: Advisory, allow: Record<string, string>) {
  const id = a.github_advisory_id
  if (!(id in allow)) return `${id} (${a.severity}, ${a.module_name}): ${a.title}`
  if (a.patched_versions !== '<0.0.0')
    return `${id} (${a.module_name}): a fix is available, update and remove it from the allowlist`
}

/** One line per advisory that fails the check, empty when it passes. */
export function problems(report: AuditReport, allow: Record<string, string> = allowed) {
  const found = Object.values(report.advisories).filter(
    (a) => a.severity === 'high' || a.severity === 'critical',
  )
  const seen = new Set(found.map((a) => a.github_advisory_id))
  const stale = Object.keys(allow)
    .filter((id) => !seen.has(id))
    .map((id) => `${id}: no longer reported, remove it from the allowlist`)
  const failing = found.map((a) => problemOf(a, allow)).filter((p) => p !== undefined)
  return [...new Set([...failing, ...stale])]
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  // pnpm audit exits 1 whenever it finds anything, so its JSON decides instead
  const run = spawnSync(executable('pnpm'), ['audit', '--json'], {
    encoding: 'utf8',
    maxBuffer: 64 << 20,
  })
  const report = JSON.parse(run.stdout || '{}') as AuditReport
  if (!report.advisories) {
    console.error(run.stdout || run.stderr)
    process.exit(1)
  }
  const found = problems(report)
  for (const line of found) console.error(line)
  if (found.length) process.exit(1)
  console.log(
    `pnpm audit: no high or critical advisory outside the allowlist (${Object.keys(allowed).join(', ')})`,
  )
}
