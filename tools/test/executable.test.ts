import { isAbsolute } from 'node:path'
import { expect, it } from 'vitest'
import { executable } from '../src/executable.ts'

it('finds pnpm by an absolute path', () => {
  expect(isAbsolute(executable('pnpm'))).toBe(true)
})

it('refuses a program that is not installed', () => {
  expect(() => executable('no-such-program')).toThrow('no-such-program not found')
})
