import { expect, it } from 'vitest'
import { listenOptions } from '../src/listen.ts'

it('listens on this machine only, port 3000, unless HOST and PORT say otherwise', () => {
  expect(listenOptions({})).toEqual({ host: '127.0.0.1', port: 3000 })
  expect(listenOptions({ HOST: '0.0.0.0', PORT: '8080' })).toEqual({ host: '0.0.0.0', port: 8080 })
})
