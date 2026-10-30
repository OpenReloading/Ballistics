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

it('passes a subpath pattern of exports that matches a packed file', () => {
  const dir = pkg(
    { ...manifest, exports: { ...manifest.exports, './data/*': './dist/data/*' } },
    { 'dist/index.js': '', 'dist/index.d.ts': '', 'dist/data/a.json': '{}' },
  )
  expect(packProblems(dir)).toEqual([])
})

it('fails on a subpath pattern of exports that matches no packed file', () => {
  const dir = pkg(
    { ...manifest, exports: { ...manifest.exports, './data/*': './dist/data/*' } },
    { 'dist/index.js': '', 'dist/index.d.ts': '' },
  )
  expect(packProblems(dir)).toEqual(['entry point dist/data/* is not in the tarball'])
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

it('reads a specifier after spaces and one parenthesis', () => {
  const dir = pkg(manifest, {
    'dist/index.js': [
      "const f = require ( 'f' )",
      "const g = import(\n  'g')",
      'export { h } from  "h"',
      "const i = require  ('i')",
      'import"j"',
      "const k = require (( 'k')",
    ].join('\n'),
    'dist/index.d.ts': '',
  })
  const problems = packProblems(dir)
  expect(problems).toEqual(
    expect.arrayContaining(
      ['f', 'g', 'h', 'i', 'j'].map(
        (name) => `dist/index.js imports ${name}, which is not in dependencies or peerDependencies`,
      ),
    ),
  )
  expect(problems).toHaveLength(5)
})

it('reads exports without main or types and skips a condition set to null', () => {
  const dir = pkg(
    {
      files: ['dist'],
      exports: { '.': { types: './dist/index.d.ts', browser: null, default: './dist/index.js' } },
    },
    { 'dist/index.js': '', 'dist/index.d.ts': '' },
  )
  expect(packProblems(dir)).toEqual([])
})

it('reads a files entry with a trailing slash as its folder', () => {
  const dir = pkg(
    {
      main: 'dist/esm/index.js',
      types: 'dist/esm/index.d.ts',
      exports: './dist/esm/index.js',
      files: ['dist/esm/'],
    },
    { 'dist/esm/index.js': '', 'dist/esm/index.d.ts': '' },
  )
  expect(packProblems(dir)).toEqual([])
})

it('packs a licence without an extension and a source map without sources', () => {
  const dir = pkg(
    { ...manifest, files: ['dist'] },
    { LICENSE: 'MIT', 'dist/index.js': '', 'dist/index.d.ts': '', 'dist/index.js.map': '{}' },
  )
  expect(packProblems(dir)).toEqual([])
})

it('finds the sources of a source map under its source root', () => {
  const dir = pkg(
    { ...manifest, files: ['dist', 'src'] },
    {
      'dist/index.js': '',
      'dist/index.d.ts': '',
      'dist/index.js.map': JSON.stringify({
        sourceRoot: '../src',
        sources: ['index.ts', 'gone.ts'],
      }),
      'src/index.ts': '',
    },
  )
  expect(packProblems(dir)).toEqual([
    'source map dist/index.js.map ships without its source src/gone.ts',
  ])
})

it('counts only whole names as always packed', () => {
  // `main` is packed whatever `files` says; neither name is a licence
  for (const main of ['licenses.js', 'docs/old-readme.md']) {
    const dir = pkg(
      { ...manifest, main },
      { [main]: '', 'dist/index.js': '', 'dist/index.d.ts': '' },
    )
    expect(packProblems(dir)).toEqual([`${main} is outside the files field`])
  }
})

it('reads the imports of .cjs and .d.mts files and not of other files', () => {
  const dir = pkg(manifest, {
    'README.md': "# p\n\nimport { p } from 'readme-example'",
    'dist/index.js': '',
    'dist/index.d.ts': '',
    'dist/index.cjs': "require('cjs-only')",
    'dist/index.d.mts': "export type T = import('mts-only').T",
    'dist/data.json': '{"note": "import \'json-text\'"}',
  })
  expect(packProblems(dir)).toEqual([
    'dist/index.cjs imports cjs-only, which is not in dependencies or peerDependencies',
    'dist/index.d.mts imports mts-only, which is not in dependencies or peerDependencies',
  ])
})

it('finds a test folder at the root and an .mjs test file, not a data file named spec', () => {
  const dir = pkg(
    { ...manifest, files: ['dist', 'test'] },
    {
      'dist/index.js': '',
      'dist/index.d.ts': '',
      'dist/run.test.mjs': '',
      'dist/case.spec.json': '{}',
      'test/a.js': '',
    },
  )
  expect(new Set(packProblems(dir))).toEqual(
    new Set([
      'test file dist/run.test.mjs is in the tarball',
      'test file test/a.js is in the tarball',
    ]),
  )
})
