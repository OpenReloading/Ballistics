import { expect, it } from 'vitest'
import { buildLine } from '../src/lib/build-line.ts'

const build = { version: '0.0.4', commit: 'abc1234', day: '2026-10-30' }

it('a release names its version, commit and build day', () => {
  expect(buildLine({ ...build, edition: 'release' })).toBe('web 0.0.4, abc1234, 2026-10-30')
})

it('the next edition is a preview after the version of the last release', () => {
  expect(buildLine({ ...build, edition: 'next' })).toBe('next abc1234, after web 0.0.4, 2026-10-30')
})

it('a local build says so, and leaves out a missing commit', () => {
  expect(buildLine({ ...build, edition: 'development' })).toBe(
    'development, web 0.0.4, abc1234, 2026-10-30',
  )
  expect(buildLine({ ...build, edition: 'development', commit: '' })).toBe(
    'development, web 0.0.4, 2026-10-30',
  )
})
