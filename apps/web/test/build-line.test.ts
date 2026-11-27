import { expect, it } from 'vitest'
import { buildLine, buildTag } from '../src/lib/build-line.ts'

const build = { development: false, version: '0.0.4', commit: 'abc1234', day: '2026-10-30' }

it('a Pages build names its version, commit and build day', () => {
  expect(buildLine(build)).toBe('web 0.0.4, abc1234, 2026-10-30')
})

it('a local build says so, and leaves out a missing commit', () => {
  expect(buildLine({ ...build, development: true })).toBe(
    'development, web 0.0.4, abc1234, 2026-10-30',
  )
  expect(buildLine({ ...build, development: true, commit: '' })).toBe(
    'development, web 0.0.4, 2026-10-30',
  )
})

it('the printed tag names the version and the commit, and a local build as such', () => {
  expect(buildTag(build)).toBe('Ballistics 0.0.4 abc1234')
  expect(buildTag({ ...build, development: true })).toBe('Ballistics development 0.0.4 abc1234')
  expect(buildTag({ ...build, commit: '' })).toBe('Ballistics 0.0.4')
})
