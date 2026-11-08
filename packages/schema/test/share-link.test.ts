import { expect, it } from 'vitest'
import { readShareLink } from '../src/share-link.ts'

it('reads a payload of up to 8000 characters and refuses a longer one before decoding it', async () => {
  // base64 of zero bytes, which no deflate stream starts with: read, then found damaged
  expect(await readShareLink(`#record=${'A'.repeat(8000)}`)).toEqual({
    ok: false,
    diagnostic: { code: 'damagedLink', params: {} },
  })
  expect(await readShareLink(`#record=${'A'.repeat(8001)}`)).toEqual({
    ok: false,
    diagnostic: { code: 'longLink', params: { maxChars: 8000 } },
  })
})
