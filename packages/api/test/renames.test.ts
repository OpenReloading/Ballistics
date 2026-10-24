import { describe, expect, it } from 'vitest'
import { buildCatalogue } from '../src/catalogue/build.ts'
import { openCatalogue } from '../src/catalogue/open.ts'
import { API_PREFIX } from '../src/version.ts'
import { bundle } from './fixtures.ts'
import { testCatalogue, withApi } from './setup.ts'

const renames = {
  cartridges: { 'old-alpha': 'alpha-rifle' },
  manufacturers: { 'old-a': 'example-a' },
  powders: { 'old-powder': 'example-a-fast' },
  bullets: { 'old-bullet': 'example-a-1' },
  'target-faces': { 'old-face': 'test-face' },
  federations: { 'old-federation': 'test-federation' },
  disciplines: { 'old-discipline': 'test-discipline' },
  'target-mappings': { 'old-mapping': 'test-discipline-test-face' },
}

describe('catalogue renames', () => {
  it('answers the id that replaced an old one, and nothing for a current or unknown id', () => {
    const catalogue = testCatalogue({ ...bundle, renames })
    expect(catalogue.renamed('cartridges', 'old-alpha')).toBe('alpha-rifle')
    expect(catalogue.renamed('cartridges', 'alpha-rifle')).toBeUndefined()
    expect(catalogue.renamed('cartridges', 'constructor')).toBeUndefined()
    expect(catalogue.renamed('bullets', 'old-alpha')).toBeUndefined()
    expect(testCatalogue(bundle).renamed('cartridges', 'old-alpha')).toBeUndefined()
  })

  it('joins a reference to an old id with the record that replaced it', () => {
    const catalogue = openCatalogue(
      buildCatalogue({
        ...bundle,
        renames,
        powders: bundle.powders.map((p) => ({ ...p, manufacturer: 'old-a' })),
        capacities: bundle.capacities.map((c) => ({ ...c, cartridge: 'old-alpha' })),
      }),
    )
    expect(catalogue.capacities('alpha-rifle').map((c) => c.id)).toEqual(['alpha-rifle-test'])
    expect(catalogue.powders().total).toBe(bundle.powders.length)
  })
})

describe('GET of a renamed id', () => {
  const api = withApi({ seed: { ...bundle, renames } })
  const location = async (path: string) => {
    const res = await api.app.inject({ url: `${API_PREFIX}${path}` })
    return [res.statusCode, res.headers.location]
  }

  it('redirects permanently to the record that replaced it, on every record route', async () => {
    for (const [kind, ids] of Object.entries(renames)) {
      const [[old, now]] = Object.entries(ids)
      expect(await location(`/${kind}/${old}`), kind).toEqual([308, `${API_PREFIX}/${kind}/${now}`])
      expect((await api.get(`/${kind}/${now}`.replace(/^/, API_PREFIX))).status, kind).toBe(200)
    }
  })

  it('still answers 404 for an unknown id and the record for a current one', async () => {
    expect(await location('/cartridges/unknown')).toEqual([404, undefined])
    expect(await location('/bullets/old-alpha')).toEqual([404, undefined])
    expect(await location('/cartridges/alpha-rifle')).toEqual([200, undefined])
  })
})
