import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { expect, it } from 'vitest'
import { packProblems } from '../src/pack-check.ts'

/** A package in a fresh temporary folder with a README, with `files` written relative to it (`undefined` leaves one out). */
function pkg(manifest: object, files: Record<string, string | undefined>) {
  const dir = mkdtempSync(join(tmpdir(), 'pack-check-'))
  writeFileSync(
    join(dir, 'package.json'),
    JSON.stringify({ name: 'p', version: '1.0.0', ...manifest }),
  )
  for (const [path, text] of Object.entries({ 'README.md': '# p', ...files })) {
    if (text === undefined) continue
    mkdirSync(dirname(join(dir, path)), { recursive: true })
    writeFileSync(join(dir, path), text)
  }
  return dir
}

const manifest = {
  main: 'dist/index.js',
  types: 'dist/index.d.ts',
  exports: { '.': { types: './dist/index.d.ts', default: './dist/index.js' } },
  files: ['dist', '!dist/**/*.map', 'LICENSE'],
}

it('passes a package that ships its entry points and nothing else', () => {
  const dir = pkg(manifest, {
    LICENSE: 'MIT',
    'dist/index.js': '',
    'dist/index.d.ts': '',
    'dist/index.js.map': '{}',
  })
  expect(packProblems(dir)).toEqual([])
})

it('fails on a missing README', () => {
  const dir = pkg(manifest, { 'README.md': undefined, 'dist/index.js': '', 'dist/index.d.ts': '' })
  expect(packProblems(dir)).toEqual(['README.md is not in the tarball'])
})

it('fails on an entry point of exports that is missing', () => {
  const dir = pkg(
    { ...manifest, exports: { ...manifest.exports, './extra': './dist/extra.js' } },
    { 'dist/index.js': '', 'dist/index.d.ts': '' },
  )
  expect(packProblems(dir)).toEqual(['entry point dist/extra.js is not in the tarball'])
})

it('fails on a test file in the tarball', () => {
  const dir = pkg(manifest, {
    'dist/index.js': '',
    'dist/index.d.ts': '',
    'dist/index.test.js': '',
  })
  expect(packProblems(dir)).toEqual(['test file dist/index.test.js is in the tarball'])
})

it('fails on a source map without its source', () => {
  const dir = pkg(
    { ...manifest, files: ['dist'] },
    {
      'dist/index.js': '',
      'dist/index.d.ts': '',
      'dist/index.js.map': JSON.stringify({ sources: ['../src/index.ts'] }),
    },
  )
  expect(packProblems(dir)).toEqual([
    'source map dist/index.js.map ships without its source src/index.ts',
  ])
})

it('fails on a file outside the files field', () => {
  // `main` is packed whatever `files` says, so a main outside it shows up.
  const dir = pkg(
    { ...manifest, main: 'index.js' },
    { 'index.js': '', 'dist/index.js': '', 'dist/index.d.ts': '' },
  )
  expect(packProblems(dir)).toEqual(['index.js is outside the files field'])
})

it('fails on a bare import that the manifest does not declare', () => {
  const dir = pkg(
    { ...manifest, name: '@scope/p', dependencies: { a: '1' }, peerDependencies: { '@b/c': '1' } },
    {
      'dist/index.js': [
        "import { readFileSync } from 'node:fs'",
        "import path from 'path'",
        "import { x } from './x.js'",
        "import a from 'a/sub'",
        "export * from '@b/c'",
        "import self from '@scope/p/other'",
        "import { z } from 'zod'",
      ].join('\n'),
      'dist/index.d.ts': "export type T = import('@d/e').T",
    },
  )
  expect(packProblems(dir)).toEqual(
    expect.arrayContaining([
      'dist/index.d.ts imports @d/e, which is not in dependencies or peerDependencies',
      'dist/index.js imports zod, which is not in dependencies or peerDependencies',
    ]),
  )
  expect(packProblems(dir)).toHaveLength(2)
})
