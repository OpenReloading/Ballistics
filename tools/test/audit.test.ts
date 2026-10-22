import { expect, it } from 'vitest'
import { type AuditReport, problems } from '../src/audit.ts'

const advisory = (id: string, name: string, severity = 'high') => ({
  name,
  title: `${name} advisory`,
  url: `https://github.com/advisories/${id}`,
  severity,
})
const report = (fixAvailable: unknown, ...via: AuditReport['vulnerabilities'][string]['via']) => ({
  vulnerabilities: {
    braces: { via, fixAvailable },
    chokidar: { via: ['braces'], fixAvailable: false },
  },
})
const allow = { 'GHSA-aaaa': 'test' }

it('passes when every high advisory is allowed and has no fix', () => {
  expect(problems(report(false, advisory('GHSA-aaaa', 'braces')), allow)).toEqual([])
})

it('fails on a high or critical advisory outside the allowlist, not on a moderate one', () => {
  const r = report(
    false,
    advisory('GHSA-aaaa', 'braces'),
    advisory('GHSA-bbbb', 'braces', 'critical'),
    advisory('GHSA-cccc', 'braces', 'moderate'),
  )
  expect(problems(r, allow)).toEqual(['GHSA-bbbb (critical, braces): braces advisory'])
})

it('fails on an allowed advisory once its package has a fix', () => {
  expect(
    problems(report({ name: 'braces', version: '3.0.4' }, advisory('GHSA-aaaa', 'braces')), allow),
  ).toEqual(['GHSA-aaaa (braces): a fix is available, update and remove it from the allowlist'])
})

it('fails on an allowlist entry npm no longer reports', () => {
  expect(problems({ vulnerabilities: {} }, allow)).toEqual([
    'GHSA-aaaa: no longer reported, remove it from the allowlist',
  ])
})
