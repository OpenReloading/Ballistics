import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import {
  installedLicenses,
  type Lock,
  noticeBlock,
  problems,
  readPolicy,
  satisfies,
  shippedPackages,
  summary,
  withoutReason,
} from '../src/licences.ts'

const allowed = new Set(['MIT', 'Apache-2.0', 'BSD-3-Clause'])

it('reads OR, AND, WITH and brackets of an SPDX expression', () => {
  expect(satisfies('MIT', allowed)).toBe(true)
  expect(satisfies('GPL-3.0-only', allowed)).toBe(false)
  expect(satisfies('(WTFPL OR MIT)', allowed)).toBe(true)
  expect(satisfies('MIT AND LGPL-3.0-or-later', allowed)).toBe(false)
  expect(satisfies('Apache-2.0 AND MIT', allowed)).toBe(true)
  expect(satisfies('GPL-2.0-only OR (MIT AND BSD-3-Clause)', allowed)).toBe(true)
  expect(satisfies('MIT AND (GPL-2.0-only OR LGPL-2.1-only)', allowed)).toBe(false)
  expect(satisfies('MIT WITH Classpath-exception-2.0', allowed)).toBe(true)
})

it('rejects an expression it cannot read', () => {
  for (const bad of ['', 'MIT AND', '(MIT', 'MIT OR OR MIT', 'MIT) AND MIT', 'MIT MIT'])
    expect(() => satisfies(bad, allowed), bad).toThrow()
})

it('reads every licence expression of the installed packages', () => {
  for (const license of installedLicenses('..').values())
    if (license !== undefined) expect(() => satisfies(license, allowed), license).not.toThrow()
})

const licenses = (...ids: string[]) => new Map(ids.map((i) => [i, 'MIT']))
const lock: Lock = {
  importers: {
    'apps/web': {
      dependencies: { a: { version: '1.0.0' }, core: { version: 'link:../../packages/core' } },
      optionalDependencies: { 'bin-linux': { version: '1.0.0' } },
    },
    'packages/core': { dependencies: { b: { version: '2.0.0' }, sharp: { version: '0.1.0' } } },
    'packages/unused': { dependencies: { unused: { version: '1.0.0' } } },
  },
  packages: {
    'a@1.0.0': { peerDependenciesMeta: { opt: { optional: true } } },
    'bin-linux@1.0.0': { os: ['linux'], cpu: ['x64'] },
  },
  snapshots: {
    'a@1.0.0': { dependencies: { b: '1.0.0', opt: '1.0.0' } },
    'b@1.0.0': {},
    'b@2.0.0': {},
    'opt@1.0.0': {},
    'sharp@0.1.0': { dependencies: { c: '1.0.0' } },
    'unused@1.0.0': {},
  },
}

it('lists the production closure: links followed, both versions, no optional peer, no platform package, no removed package', () => {
  const found = shippedPackages(
    lock,
    licenses('a@1.0.0', 'b@1.0.0'),
    ['apps/web'],
    (name) => name === 'sharp' || name === 'bin-linux',
  )
  expect(found).toEqual([
    { name: 'a', version: '1.0.0', license: 'MIT' },
    { name: 'b', version: '1.0.0', license: 'MIT' },
    { name: 'b', version: '2.0.0', license: undefined },
  ])
})

it('fails on a licence outside the list and on no licence, not on an excepted package', () => {
  const packages = [
    { name: 'ok', version: '1.0.0', license: 'MIT' },
    { name: 'gpl', version: '1.0.0', license: 'GPL-3.0-only' },
    { name: 'none', version: '1.0.0', license: undefined },
    { name: 'odd', version: '1.0.0', license: 'MIT AND' },
    { name: '@s/data', version: '1.0.0', license: 'CC-BY-4.0' },
  ]
  const policy = readPolicy(
    'allow-licenses: [MIT]\nallow-dependencies-licenses:\n  - pkg:npm/%40s/data # data only\n',
  )
  expect(problems(packages, policy)).toEqual([
    'gpl@1.0.0: GPL-3.0-only is not in allow-licenses',
    'none@1.0.0: no licence declared',
    'odd@1.0.0: cannot read the licence expression "MIT AND"',
  ])
})

it('wants a reason on the line of every excepted package', () => {
  expect(withoutReason('x:\n  - pkg:npm/a # why\n  - pkg:npm/b\n  - "pkg:npm/c" #\n')).toEqual([
    '  - pkg:npm/b',
    '  - "pkg:npm/c" #',
  ])
})

const permissive = new Set([
  ...['MIT', 'MIT-0', 'Apache-2.0', 'BSD-2-Clause', 'BSD-3-Clause', 'ISC', '0BSD'],
  ...['CC0-1.0', 'Unlicense', 'BlueOak-1.0.0', 'Python-2.0'],
])

it('keeps no exception in the review configuration without a reason, and no copyleft licence beyond MPL and LGPL', () => {
  const text = readFileSync('../.github/dependency-review-config.yml', 'utf8')
  expect(withoutReason(text)).toEqual([])
  const { allow } = readPolicy(text)
  expect([...allow].filter((l) => !permissive.has(l)).sort()).toEqual([
    'LGPL-2.1-or-later',
    'LGPL-3.0-or-later',
    'MPL-2.0',
  ])
})

it('writes the NOTICE block with one line per package', () => {
  const block = noticeBlock([{ name: 'a', version: '1.0.0', license: undefined }])
  expect(block.split('\n').at(-2)).toBe('a 1.0.0 UNDECLARED')
})

it('names an unbalanced bracket and an operator or bracket where a licence belongs', () => {
  expect(() => satisfies('(MIT', allowed)).toThrow('unbalanced brackets in "(MIT"')
  expect(() => satisfies('MIT MIT', allowed)).toThrow(
    'cannot read the licence expression "MIT MIT"',
  )
  for (const bad of ['AND MIT', 'MIT OR AND', 'MIT OR OR', 'MIT AND WITH', ')', 'MIT OR )'])
    expect(() => satisfies(bad, allowed), bad).toThrow(
      `cannot read the licence expression "${bad}"`,
    )
})

const ids = (found: { name: string; version: string }[]) =>
  found.map((p) => `${p.name}@${p.version}`)

it('fails on a platform package that notShipped does not name', () => {
  expect(() =>
    shippedPackages(lock, licenses('a@1.0.0'), ['apps/web'], (name) => name === 'sharp'),
  ).toThrow('bin-linux@1.0.0 is a platform package in a shipped closure')
})

it('leaves out sharp, the @img scope and the Next.js compiler by default and starts from the API and the web app', () => {
  const shipped: Lock = {
    importers: {
      'packages/api': {
        dependencies: {
          sharp: { version: '0.1.0' },
          '@img/sharp-wasm32': { version: '0.1.0' },
          '@imgx/a': { version: '1.0.0' },
          '@next/swc-linux-x64-gnu': { version: '1.0.0' },
        },
      },
      'apps/web': { dependencies: { b: { version: '1.0.0' } } },
      'apps/docs': { dependencies: { c: { version: '1.0.0' } } },
    },
  }
  expect(shippedPackages(shipped, licenses('@imgx/a@1.0.0', 'b@1.0.0', 'c@1.0.0'))).toEqual([
    { name: '@imgx/a', version: '1.0.0', license: 'MIT' },
    { name: 'b', version: '1.0.0', license: 'MIT' },
  ])
})

it('follows a version with resolved peers to its snapshot and lists it once, past a cycle and a missing workspace', () => {
  const peers: Lock = {
    importers: {
      root: {
        dependencies: {
          a: { version: '1.0.0(react@19.0.0)' },
          b: { version: '1.0.0(react@18.0.0)' },
          gone: { version: 'link:../gone' },
        },
      },
    },
    snapshots: {
      'a@1.0.0(react@19.0.0)': { dependencies: { react: '19.0.0', cycle: '1.0.0' } },
      'b@1.0.0(react@18.0.0)': { dependencies: { a: '1.0.0(react@19.0.0)' } },
      'cycle@1.0.0': { dependencies: { a: '1.0.0(react@19.0.0)' } },
    },
  }
  expect(ids(shippedPackages(peers, new Map(), ['root'], () => false))).toEqual([
    'a@1.0.0',
    'b@1.0.0',
    'cycle@1.0.0',
    'react@19.0.0',
  ])
})

it('refuses a policy whose lists are no lists of text or name no npm package', () => {
  expect(readPolicy('allow-licenses: [MIT]\n').excepted).toEqual(new Set())
  expect(() => readPolicy('allow-licenses: MIT\n')).toThrow(
    'allow-licenses must be a list of strings',
  )
  expect(() => readPolicy('allow-licenses: [MIT, 3]\n')).toThrow(
    'allow-licenses must be a list of strings',
  )
  expect(() =>
    readPolicy('allow-licenses: [MIT]\nallow-dependencies-licenses: [pkg:pypi/a]\n'),
  ).toThrow('pkg:pypi/a: only pkg:npm/ entries')
})

it('takes a reason comment without a space after the hash, and reads no comment line as an entry', () => {
  expect(withoutReason('  - pkg:npm/a #why\n# was - pkg:npm/b\n')).toEqual([])
})

it('writes the NOTICE block between its markers with its preamble', () => {
  expect(noticeBlock([{ name: 'a', version: '1.0.0', license: 'MIT' }])).toBe(
    [
      'BEGIN GENERATED: shipped packages',
      'Third-party packages installed for the API image and the web app, by name, version and the licence',
      'the package declares. Written by `node tools/src/licences.ts --write`.',
      '',
      'a 1.0.0 MIT',
      'END GENERATED: shipped packages',
    ].join('\n'),
  )
})

it('sums the job summary by licence, most used first, and names the excepted packages', () => {
  const packages = [
    { name: 'a', version: '1.0.0', license: 'MIT' },
    { name: 'b', version: '1.0.0', license: undefined },
    { name: 'c', version: '1.0.0', license: 'ISC' },
    { name: 'd', version: '2.0.0', license: 'ISC' },
    { name: 'e', version: '1.0.0', license: undefined },
  ]
  expect(summary(packages, new Set(['c', 'd'])).split('\n')).toEqual([
    '### Licences of the production dependencies of the API image and the web app',
    '',
    '| Licence | Packages |',
    '| --- | --- |',
    '| UNDECLARED | 2 |',
    '| ISC | 2 |',
    '| MIT | 1 |',
    '',
    'Excepted by name in the review configuration: c 1.0.0, d 2.0.0',
    '',
    '<details><summary>All packages</summary>',
    '',
    '```',
    'a 1.0.0 MIT',
    'b 1.0.0 UNDECLARED',
    'c 1.0.0 ISC',
    'd 2.0.0 ISC',
    'e 1.0.0 UNDECLARED',
    '```',
    '',
    '</details>',
    '',
  ])
  expect(summary(packages, new Set()).split('\n')[8]).toBe('')
})
