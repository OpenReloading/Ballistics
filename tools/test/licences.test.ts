import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import {
  type Lock,
  noticeBlock,
  problems,
  readPolicy,
  satisfies,
  shippedPackages,
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
      dependencies: { a: '*', core: '*' },
      optionalDependencies: { 'bin-darwin': '*' },
    },
    'node_modules/core': { link: true, resolved: 'packages/core' },
    'packages/core': { dependencies: { b: '*', sharp: '*' } },
    'node_modules/a': entry('1.0.0', 'MIT', { dependencies: { b: '*' } }),
    'node_modules/a/node_modules/b': entry('2.0.0', 'ISC'),
    'node_modules/b': entry('1.0.0', 'ISC'),
    'node_modules/sharp': entry('0.1.0', 'LGPL-3.0-or-later'),
    'node_modules/bin-darwin': entry('1.0.0', 'GPL-3.0-only', { os: ['darwin'] }),
    'node_modules/unused': entry('1.0.0', 'GPL-3.0-only'),
  },
}

it('lists the production closure: links followed, nearest copy, no other platform, no removed package', () => {
  const found = shippedPackages(lock, ['apps/web'], (name) => name === 'sharp')
  expect(found.map((p) => `${p.name}@${p.version}`)).toEqual(['a@1.0.0', 'b@1.0.0', 'b@2.0.0'])
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
