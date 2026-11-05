import { expect, it } from 'vitest'
import { type AuditReport, problems } from '../src/audit.ts'

const advisory = (id: string, severity = 'high', patched: string | null = null) => ({
  github_advisory_id: id,
  module_name: 'braces',
  title: 'braces advisory',
  severity,
  patched_versions: patched,
})
const report = (...found: AuditReport['advisories'][string][]): AuditReport => ({
  advisories: Object.fromEntries(found.map((a, i) => [String(i), a])),
})
const allow = { 'GHSA-aaaa': 'test' }

it('passes when every high advisory is allowed and has no fix', () => {
  expect(problems(report(advisory('GHSA-aaaa')), allow)).toEqual([])
})

it('fails on a high or critical advisory outside the allowlist, not on a moderate one', () => {
  const r = report(
    advisory('GHSA-aaaa'),
    advisory('GHSA-bbbb', 'critical'),
    advisory('GHSA-cccc', 'moderate'),
  )
  expect(problems(r, allow)).toEqual(['GHSA-bbbb (critical, braces): braces advisory'])
})

it('fails on an allowed advisory once its package has a fix', () => {
  expect(problems(report(advisory('GHSA-aaaa', 'high', '>=3.0.3')), allow)).toEqual([
    'GHSA-aaaa (braces): a fix is available, update and remove it from the allowlist',
  ])
})

it('fails on an allowlist entry pnpm no longer reports', () => {
  expect(problems({ advisories: {} }, allow)).toEqual([
    'GHSA-aaaa: no longer reported, remove it from the allowlist',
  ])
})
