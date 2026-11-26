import { createHash } from 'node:crypto'
import { expect, test } from '@playwright/test'

test('the export serves the hole model file, and the service worker does not precache it', async ({
  request,
}) => {
  const res = await request.get('./models/hole-model-0.1.0.onnx')
  expect(res.status()).toBe(200)
  const body = await res.body()
  expect(body.byteLength).toBe(792640)
  expect(createHash('sha256').update(body).digest('hex')).toBe(
    '43631bba97d43f2cc838dab83ec024a24f39c0ef687a7d8b1cf0763cbbf8a023',
  )
  expect(await (await request.get('./sw.js')).text()).not.toContain('hole-model')
})
