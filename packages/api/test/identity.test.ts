import { describe, expect, it } from 'vitest'
import { buildCatalogue } from '../src/catalogue/build.ts'
import { openCatalogue } from '../src/catalogue/open.ts'
import { chargeTargetExample } from '../src/compute/charge-schema.ts'
import { trajectoryExample } from '../src/compute/exterior-schema.ts'
import { interiorExample } from '../src/compute/interior-schema.ts'
import { loadFileExample } from '../src/compute/load-file-example.ts'
import { canonicalJson, sha256 } from '../src/hash.ts'
import { API_PREFIX, API_VERSION } from '../src/version.ts'
import { bundle } from './fixtures.ts'
import { testCatalogue, withApi } from './setup.ts'

const api = withApi()
const hex64 = /^[0-9a-f]{64}$/

/** The same object with its keys in the reverse order, at every depth. */
const reversed = (value: unknown): unknown =>
  Array.isArray(value)
    ? value.map(reversed)
    : value !== null && typeof value === 'object'
      ? Object.fromEntries(
          Object.entries(value)
            .reverse()
            .map(([k, v]) => [k, reversed(v)]),
        )
      : value

describe('hashes', () => {
  it('sha256 gives the standard digest', async () => {
    expect(await sha256('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    )
  })

  it('canonicalJson sorts the keys at every depth and keeps the order of arrays', () => {
    expect(canonicalJson({ b: [{ d: 1, c: 2 }, 3], a: null })).toBe(
      '{"a":null,"b":[{"c":2,"d":1},3]}',
    )
    expect(canonicalJson(reversed(trajectoryExample))).toBe(canonicalJson(trajectoryExample))
  })
})

describe('compute answers say what produced them', () => {
  const url = `${API_PREFIX}/exterior/trajectory`

  it('carries inputHash, apiVersion and dataHash', async () => {
    const { status, body } = await api.post(url, trajectoryExample)
    expect(status).toBe(200)
    expect(body.inputHash).toBe(await sha256(canonicalJson(trajectoryExample)))
    expect(body.apiVersion).toBe(API_VERSION)
    expect(body.dataHash).toBe(await api.catalogue.dataHash())
    expect(body.dataHash).toMatch(hex64)
  })

  it('gives the same inputHash for the body with its keys in any order, another for another body', async () => {
    const a = (await api.post(url, trajectoryExample)).body
    const b = (await api.post(url, reversed(trajectoryExample))).body
    expect(b.inputHash).toBe(a.inputHash)
    expect(b.result).toEqual(a.result)
    const other = { ...trajectoryExample, ranges: [...trajectoryExample.ranges, 900] }
    expect((await api.post(url, other)).body.inputHash).not.toBe(a.inputHash)
  })

  it.each([
    ['interior', `${API_PREFIX}/interior`, interiorExample],
    ['charge target', `${API_PREFIX}/interior/charge-target`, chargeTargetExample],
  ])('the %s route carries them', async (_name, route, example) => {
    const { status, body } = await api.post(route, example)
    expect(status).toBe(200)
    expect(body.inputHash).toBe(await sha256(canonicalJson(example)))
    expect(body.apiVersion).toBe(API_VERSION)
    expect(body.dataHash).toMatch(hex64)
  })

  it('hashes the query of a request without a body, and the body and query of a load file', async () => {
    const stability = (q: string) => api.get(`${API_PREFIX}/exterior/stability?${q}`)
    const query = 'mass=0.01&diameter=0.00782&length=0.03&twist=0.3&muzzleVelocity=800'
    const a = (await stability(query)).body
    expect(a.inputHash).toBe(
      await sha256(
        canonicalJson({
          mass: '0.01',
          diameter: '0.00782',
          length: '0.03',
          twist: '0.3',
          muzzleVelocity: '800',
        }),
      ),
    )
    expect((await stability(query.split('&').reverse().join('&'))).body.inputHash).toBe(a.inputHash)
    const load = `${API_PREFIX}/interior/load-file`
    const plain = await api.post(load, loadFileExample)
    const curves = await api.post(`${load}?curves=true`, loadFileExample)
    for (const r of [plain, curves]) expect(r.status).toBe(200)
    expect(plain.body.inputHash).toBe(await sha256(canonicalJson(loadFileExample)))
    expect(curves.body.inputHash).toBe(
      await sha256(canonicalJson({ body: loadFileExample, query: { curves: 'true' } })),
    )
  })

  it('leaves errors without them', async () => {
    const { status, body } = await api.post(url, { ...trajectoryExample, extra: 1 })
    expect(status).toBe(400)
    expect(body).not.toHaveProperty('inputHash')
    expect(body).not.toHaveProperty('dataHash')
  })

  it('leaves record answers as they were', async () => {
    const { body } = await api.get(`${API_PREFIX}/cartridges`)
    expect(body).not.toHaveProperty('dataHash')
  })
})

describe('Catalogue.dataHash', () => {
  it('is the same for the same records, whatever the key order, and changes with a field', async () => {
    const hash = (data: typeof bundle) => testCatalogue(data).dataHash()
    const base = await hash(bundle)
    expect(base).toMatch(hex64)
    expect(await hash(structuredClone(bundle))).toBe(base)
    expect(await hash(reversed(bundle) as typeof bundle)).toBe(base)
    const [first, ...rest] = bundle.powders
    const changed = {
      ...bundle,
      powders: [{ ...first, name: `${first?.name} x` }, ...rest],
    } as typeof bundle
    expect(await hash(changed)).not.toBe(base)
  })

  it('tries again after a failed read of the record file', async () => {
    const data = buildCatalogue(bundle)
    let fail = true
    const catalogue = openCatalogue({
      index: data.index,
      records: () => {
        if (fail) throw new Error('read failed')
        return data.records
      },
    })
    await expect(catalogue.dataHash()).rejects.toThrow('read failed')
    fail = false
    expect(await catalogue.dataHash()).toBe(await testCatalogue(bundle).dataHash())
  })
})
