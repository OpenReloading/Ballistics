import { expect, it } from 'vitest'
import { confined } from '../src/confined.ts'

it('accepts a file below a root', () => {
  expect(confined('/repo/packages/api/openapi.json', ['/repo'])).toBe(
    '/repo/packages/api/openapi.json',
  )
  expect(confined('/tmp/openapi.json', ['/repo', '/tmp'])).toBe('/tmp/openapi.json')
})

it('refuses a file outside every root, also through ..', () => {
  expect(() => confined('/etc/passwd', ['/repo'])).toThrow('outside')
  expect(() => confined('/repo/../etc/passwd', ['/repo'])).toThrow('outside')
  expect(() => confined('/repo-other/file', ['/repo'])).toThrow('outside')
})

it('refuses the root itself', () => {
  expect(() => confined('/repo', ['/repo'])).toThrow('outside')
})
