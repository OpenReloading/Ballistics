import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import {
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

it('reads every licence expression of the lock', () => {
  const lock = JSON.parse(readFileSync('../package-lock.json', 'utf8')) as Lock
  for (const { license } of Object.values(lock.packages))
    if (typeof license === 'string')
      expect(() => satisfies(license, allowed), license).not.toThrow()
})

const entry = (version: string, license: string | undefined, rest = {}) => ({
  version,
  ...(license ? { license } : {}),
  ...rest,
})
const lock: Lock = {
  packages: {
    'apps/web': {
      dependencies: { a: '*', core: '*', 'not-windows': '*', 'not-linux': '*', musl: '*' },
      optionalDependencies: { 'bin-darwin': '*' },
    },
    'node_modules/core': { link: true, resolved: 'packages/core' },
    'packages/core': { dependencies: { b: '*', sharp: '*' } },
    'node_modules/a': entry('1.0.0', 'MIT', { dependencies: { b: '*' } }),
    'node_modules/a/node_modules/b': entry('2.0.0', 'ISC'),
    'node_modules/b': entry('1.0.0', 'ISC'),
    'node_modules/sharp': entry('0.1.0', 'LGPL-3.0-or-later'),
    'node_modules/bin-darwin': entry('1.0.0', 'GPL-3.0-only', { os: ['darwin'] }),
    'node_modules/not-windows': entry('1.0.0', 'MIT', { os: ['!win32'] }),
    'node_modules/not-linux': entry('1.0.0', 'GPL-3.0-only', { os: ['!linux'] }),
    'node_modules/musl': entry('1.0.0', 'GPL-3.0-only', { libc: ['musl'] }),
    'node_modules/unused': entry('1.0.0', 'GPL-3.0-only'),
  },
}

it('lists the production closure: links followed, nearest copy, a negated or other platform left out, no removed package', () => {
  const found = shippedPackages(lock, ['apps/web'], (name) => name === 'sharp')
  expect(found.map((p) => `${p.name}@${p.version}`)).toEqual([
    'a@1.0.0',
    'b@1.0.0',
    'b@2.0.0',
    'not-windows@1.0.0',
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

it('keeps no exception in the review configuration without a reason, and no copyleft licence', () => {
  const text = readFileSync('../.github/dependency-review-config.yml', 'utf8')
  expect(withoutReason(text)).toEqual([])
  const { allow } = readPolicy(text)
  expect([...allow].filter((l) => /GPL|SSPL|MPL|CC-BY/.test(l))).toEqual([])
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

it('leaves out sharp and the @img scope by default and starts from the API and the web app', () => {
  const shipped: Lock = {
    packages: {
      'packages/api': { dependencies: { sharp: '*', '@img/sharp-linux-x64': '*', '@imgx/a': '*' } },
      'apps/web': { dependencies: { b: '*' } },
      'apps/docs': { dependencies: { c: '*' } },
      'node_modules/sharp': entry('0.1.0', 'Apache-2.0'),
      'node_modules/@img/sharp-linux-x64': entry('0.1.0', 'LGPL-3.0-or-later'),
      'node_modules/@imgx/a': entry('1.0.0', 'MIT'),
      'node_modules/b': entry('1.0.0', 'MIT'),
      'node_modules/c': entry('1.0.0', 'MIT'),
    },
  }
  expect(shippedPackages(shipped)).toEqual([
    { name: '@imgx/a', version: '1.0.0', license: 'MIT' },
    { name: 'b', version: '1.0.0', license: 'MIT' },
  ])
})

it('resolves a dependency from the nearest folder up a nested tree', () => {
  const nested: Lock = {
    packages: {
      root: { dependencies: { a: '*' } },
      'node_modules/a': entry('1.0.0', 'MIT', { dependencies: { b: '*' } }),
      'node_modules/a/node_modules/b': entry('2.0.0', 'MIT', { dependencies: { c: '*', d: '*' } }),
      'node_modules/a/node_modules/c': entry('2.0.0', 'MIT'),
      'node_modules/c': entry('1.0.0', 'MIT'),
      'node_modules/d': entry('1.0.0', 'MIT'),
    },
  }
  expect(ids(shippedPackages(nested, ['root'], () => false))).toEqual([
    'a@1.0.0',
    'b@2.0.0',
    'c@2.0.0',
    'd@1.0.0',
  ])
})

it('goes on past a dependency not installed, a link without a target and a cycle', () => {
  const gaps: Lock = {
    packages: {
      root: { dependencies: { first: '*', missing: '*', last: '*', link: '*', cycle: '*' } },
      'node_modules/first': entry('1.0.0', 'MIT'),
      'node_modules/last': entry('1.0.0', 'MIT'),
      'node_modules/link': { link: true },
      'node_modules/cycle': entry('1.0.0', 'MIT', { dependencies: { cycle2: '*' } }),
      'node_modules/cycle2': entry('1.0.0', 'MIT', { dependencies: { cycle: '*' } }),
    },
  }
  expect(ids(shippedPackages(gaps, ['root'], () => false))).toEqual([
    'cycle2@1.0.0',
    'cycle@1.0.0',
    'first@1.0.0',
    'last@1.0.0',
  ])
})

it('keeps a package built for one of the two processors or for glibc, and reads mixed lists', () => {
  const platforms: Lock = {
    packages: {
      root: { dependencies: { x64: '*', arm64: '*', ia32: '*', glibc: '*', mixed: '*' } },
      'node_modules/x64': entry('1.0.0', 'MIT', { cpu: ['x64'] }),
      'node_modules/arm64': entry('1.0.0', 'MIT', { cpu: ['arm64'] }),
      'node_modules/ia32': entry('1.0.0', 'MIT', { cpu: ['ia32'] }),
      'node_modules/glibc': entry('1.0.0', 'MIT', { libc: ['glibc'] }),
      'node_modules/mixed': entry('1.0.0', 'MIT', { cpu: ['!ia32', 'arm'] }),
    },
  }
  expect(ids(shippedPackages(platforms, ['root'], () => false))).toEqual([
    'arm64@1.0.0',
    'glibc@1.0.0',
    'x64@1.0.0',
  ])
})

it('takes a licence that is no text for none and a missing version for an empty one', () => {
  const odd: Lock = {
    packages: {
      root: { dependencies: { a: '*', b: '*' } },
      'node_modules/a': { version: '1.0.0', license: { type: 'MIT' } },
      'node_modules/b': { license: 'MIT' },
    },
  }
  expect(shippedPackages(odd, ['root'], () => false)).toEqual([
    { name: 'a', version: '1.0.0', license: undefined },
    { name: 'b', version: '', license: 'MIT' },
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
      'package-lock.json declares. Written by `node tools/src/licences.ts --write`.',
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
