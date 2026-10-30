import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { gzipSync } from 'node:zlib'
import { expect, it } from 'vitest'
import {
  type Budget,
  measure,
  nearLimit,
  parseClientManifest,
  table,
  violations,
} from '../scripts/check-weight.mts'

const budget: Budget = {
  groups: {
    pages: { budget: { initial: 100, total: 150 }, routes: { '/a': { initial: 90, total: 120 } } },
  },
}

/** A build directory with one route `/a`: a shared file, a client chunk and a lazy chunk. */
function build(files: Record<string, string>) {
  const next = mkdtempSync(path.join(tmpdir(), 'weight-'))
  const put = (name: string, content: string) => {
    mkdirSync(path.dirname(path.join(next, name)), { recursive: true })
    writeFileSync(path.join(next, name), content)
  }
  put('app-path-routes-manifest.json', JSON.stringify({ '/a/page': '/a', '/b/route': '/b' }))
  put(
    'build-manifest.json',
    JSON.stringify({ rootMainFiles: ['static/main.js'], polyfillFiles: [] }),
  )
  put(
    'server/app/a/page_client-reference-manifest.js',
    `globalThis.__RSC_MANIFEST = globalThis.__RSC_MANIFEST || {};\nglobalThis.__RSC_MANIFEST["/a/page"] = ${JSON.stringify(
      {
        clientModules: { m: { chunks: ['/_next/static/chunk.js', '/_next/static/chunk.css'] } },
        entryJSFiles: { layout: ['static/main.js'] },
      },
    )}`,
  )
  put(
    'server/app/a/page/react-loadable-manifest.json',
    JSON.stringify({ 1: { files: ['static/lazy.js', 'static/chunk.js'] } }),
  )
  for (const [name, content] of Object.entries(files)) put(name, content)
  return next
}

it('reads the object of a client reference manifest', () => {
  const source = `globalThis.__RSC_MANIFEST = globalThis.__RSC_MANIFEST || {};\nglobalThis.__RSC_MANIFEST["/x/page"] = {"clientModules":{}};`
  expect(parseClientManifest(source).clientModules).toEqual({})
})

it('counts each file once in gzip bytes: initial files first, lazy chunks in the total', () => {
  const files = {
    'static/main.js': 'main'.repeat(50),
    'static/chunk.js': 'chunk'.repeat(50),
    'static/lazy.js': 'lazy'.repeat(50),
  }
  const gz = (s: string) => gzipSync(s, { level: 9 }).length
  const initial = gz(files['static/main.js']) + gz(files['static/chunk.js'])
  expect(measure(build(files))).toEqual({
    '/a': { initial, total: initial + gz(files['static/lazy.js']) },
  })
})

it('fails on a route whose manifest is missing', () => {
  const next = build({ 'static/main.js': '', 'static/chunk.js': '', 'static/lazy.js': '' })
  writeFileSync(
    path.join(next, 'app-path-routes-manifest.json'),
    JSON.stringify({ '/c/page': '/c' }),
  )
  expect(() => measure(next)).toThrow('/c: no client reference manifest')
})

it('passes at the budget and fails one byte over, per measure', () => {
  expect(violations({ '/a': { initial: 100, total: 150 } }, budget)).toEqual([])
  expect(violations({ '/a': { initial: 101, total: 150 } }, budget)).toEqual([
    '/a: initial 101 B over the pages budget of 100 B',
  ])
  expect(violations({ '/a': { initial: 100, total: 151 } }, budget)).toEqual([
    '/a: total 151 B over the pages budget of 150 B',
  ])
})

it('fails on a built route in no group and on a group route the build lacks', () => {
  const fits = { initial: 1, total: 1 }
  expect(violations({ '/a': fits, '/new': fits }, budget)).toEqual([
    '/new: in no group of weight-budget.json',
  ])
  expect(violations({}, budget)).toEqual(['/a: in group pages but not in the build'])
})

it('tabulates the change against the recorded weight', () => {
  const big: Budget = {
    groups: {
      pages: {
        budget: { initial: 100_000, total: 150_000 },
        routes: { '/a': { initial: 90_000, total: 120_000 } },
      },
    },
  }
  const rows = table({ '/a': { initial: 95_000, total: 120_000 } }, big).split('\n')
  expect(rows[2]).toBe(
    '| pages | `/a` | 95.0 kB | +5000 B | 120.0 kB | 0 | 100.0 kB / 150.0 kB | 5000 B / 30000 B |',
  )
})

it('warns once per route with less than 1 % of its budget left, not on a route over it', () => {
  const big: Budget = {
    groups: {
      pages: {
        budget: { initial: 100_000, total: 150_000 },
        routes: { '/a': { initial: 0, total: 0 }, '/b': { initial: 0, total: 0 } },
      },
    },
  }
  const near = { '/a': { initial: 99_001, total: 149_000 }, '/b': { initial: 99_000, total: 1 } }
  expect(nearLimit(near, big)).toEqual([
    '/a: near the limit of the pages budget, initial 999 B left, total 1000 B left',
  ])
  expect(violations(near, big)).toEqual([])
  expect(
    nearLimit({ '/a': { initial: 100_001, total: 1 }, '/b': { initial: 1, total: 1 } }, big),
  ).toEqual([])
})

it('tabulates a built route in no group, for the budget it needs', () => {
  const rows = table({ '/new': { initial: 1_000, total: 2_000 } }, { groups: {} }).split('\n')
  expect(rows[2]).toBe('| none | `/new` | 1.0 kB | new | 2.0 kB | new | none | none |')
})

// The 2 % margin applies when a budget is set or raised; recorded weights may later grow into it.
it('keeps every group budget at least at its largest recorded weight', () => {
  const file = readFileSync(path.join(import.meta.dirname, '..', 'weight-budget.json'), 'utf8')
  const recorded = JSON.parse(file) as Budget
  const largest = (group: Budget['groups'][string], key: 'initial' | 'total') =>
    Math.max(...Object.values(group.routes).map((w) => w[key]))
  for (const [name, group] of Object.entries(recorded.groups)) {
    expect(group.budget.initial, name).toBeGreaterThanOrEqual(largest(group, 'initial'))
    expect(group.budget.total, name).toBeGreaterThanOrEqual(largest(group, 'total'))
  }
})
