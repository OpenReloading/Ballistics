import { isAbsolute } from 'node:path'
import { expect, it } from 'vitest'
import { executable } from '../src/executable.ts'

it('finds npm by an absolute path', () => {
  expect(isAbsolute(executable('npm'))).toBe(true)
})

it('refuses a program that is not installed', () => {
  expect(() => executable('no-such-program')).toThrow('no-such-program not found')
})
