import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { buildApp } from '../src/app.ts'
import { buildCatalogue } from '../src/catalogue/build.ts'
import { openCatalogue } from '../src/catalogue/open.ts'
import { inlineRunner } from '../src/compute/tasks.ts'
import { startBundleApi, writeStaticApi } from '../src/static.ts'
import { bundle } from './fixtures.ts'

const dir = mkdtempSync(join(tmpdir(), 'static-api-'))
afterAll(() => rmSync(dir, { recursive: true, force: true }))
const read = (file: string) => JSON.parse(readFileSync(join(dir, file), 'utf8'))

describe('writeStaticApi', () => {
  it('writes the index and, per record, the body the API answers with', async () => {
    const data = buildCatalogue(bundle)
    await writeStaticApi(data, dir)
    expect(read('catalogue/index.json')).toEqual(JSON.parse(JSON.stringify(data.index)))
    const app = buildApp({ catalogue: openCatalogue(data), compute: inlineRunner })
    expect(data.index.cartridges.length + data.index.bullets.length).toBeGreaterThan(0)
    for (const { item } of data.index.cartridges) {
      const live = await app.inject({ url: `/v1/cartridges/${item.id}` })
      expect(read(`cartridges/${item.id}.json`)).toEqual(live.json())
    }
    for (const { item } of data.index.bullets) {
      const live = await app.inject({ url: `/v1/bullets/${item.id}` })
      expect(read(`bullets/${item.id}.json`)).toEqual(live.json())
    }
  })
})

describe('startBundleApi', () => {
  it('serves the bundle on a free local port', async () => {
    const api = await startBundleApi()
    try {
      expect(api.url).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/)
      const response = await fetch(`${api.url}/v1/cartridges`)
      expect(response.status).toBe(200)
    } finally {
      await api.close()
    }
  })
})
