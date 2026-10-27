import { checkUserRefs, type UserBullet, type UserRecord, userRecord } from '@open-reloading/schema'
import { afterEach, expect, it, vi } from 'vitest'
import {
  baseChanged,
  baseProblem,
  catalogueIdOf,
  catalogueRef,
  resolveBullet,
  resolveCartridge,
  userBullets,
  userCartridges,
  userRef,
} from '../src/lib/variants.ts'
import { matchBullet } from './fixtures/bullets.ts'
import { sheetRecord } from './records.ts'

// these tests stub `fetch` as the API's own answers: the browser's calls go to it as written, in place of the data files and the compute worker
vi.mock('../src/lib/static-api.ts', () => ({
  staticFetch: (path: string, init?: RequestInit) => fetch(`/api/${path}`, init),
}))

afterEach(() => vi.unstubAllGlobals())

/** A `localStorage` in memory, as the browser keeps the last read of each base. */
function stubStorage() {
  const items = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => items.get(k) ?? null,
    setItem: (k: string, v: string) => void items.set(k, v),
    removeItem: (k: string) => void items.delete(k),
  })
}

const saved = '2026-10-24T08:00:00.000Z'
const uuid = '6f0f4d3e-0a43-4a43-9a3d-3a2f2e1f0c11'
const cartridge308 = sheetRecord('cip-308-win-2008-09-23')

/** The API as the browser sees it: the records it knows, 404 for the others, `down` fails the call. */
function stubApi(records: Record<string, unknown>, down = false) {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) => {
      if (down) return Promise.reject(new TypeError('network'))
      const found = records[decodeURIComponent(url.replace('/api/', ''))]
      return Promise.resolve(found ? Response.json(found) : new Response('{}', { status: 404 }))
    }),
  )
}

const bulletData = (basedOn?: string): UserBullet => ({
  origin: 'user',
  manufacturer: 'catalogue:example-a',
  ...(basedOn && { basedOn }),
  overrides: { name: 'My 168', mass: { value: 11 } },
})
const bulletRecord = (basedOn?: string): UserRecord => ({
  kind: 'bullet',
  id: uuid,
  name: 'My 168',
  saved,
  data: bulletData(basedOn),
})

it('resolves a user bullet against its base: the base values with the overrides on top', async () => {
  stubApi({ [`bullets/${matchBullet.id}`]: matchBullet })
  const r = await resolveBullet(bulletData(`catalogue:${matchBullet.id}`))
  expect(r.problem).toBeUndefined()
  expect(r.base.status).toBe('found')
  expect(r.record.mass?.value).toBe(11)
  expect(r.record.diameter?.value).toBe(7.823)
  expect(r.record.base).toEqual({ type: 'boat-tail' })
})

it('resolves a user bullet without a base from its overrides alone', async () => {
  const r = await resolveBullet(bulletData())
  expect(r.base).toEqual({ status: 'none' })
  expect(r.problem).toBeUndefined()
  expect(r.record.mass?.value).toBe(11)
})

it('names a base the catalogue no longer has, and keeps a network error apart from it', async () => {
  const data = bulletData('catalogue:gone-1')
  stubApi({})
  const missing = await resolveBullet(data)
  expect(missing.base).toEqual({ status: 'missing', ref: 'catalogue:gone-1' })
  expect(missing.problem).toContain('catalogue:gone-1')
  stubApi({}, true)
  const down = await resolveBullet(data)
  expect(down.base.status).toBe('unreachable')
  expect(baseProblem(down.base)).toContain('could not be read')
})

it('resolves a user cartridge: the values merge by side, symbol and variant', async () => {
  stubApi({ [`cartridges/${cartridge308.id}`]: cartridge308 })
  const l3 = cartridge308.values.find((v) => v.symbol === 'L3' && v.side === 'cartridge')
  const r = await resolveCartridge({
    origin: 'user',
    basedOn: `catalogue:${cartridge308.id}`,
    overrides: {
      values: [{ side: 'cartridge', symbol: 'L3', quantity: 'length', value: 52 }],
    },
  })
  expect(r.problem).toBeUndefined()
  expect(r.record.values).toHaveLength(cartridge308.values.length)
  expect(r.record.values.find((v) => v.symbol === 'L3' && v.side === 'cartridge')?.value).toBe(52)
  expect(l3?.value).not.toBe(52)
})

it('lists only the user records whose base resolves', async () => {
  stubApi({ [`bullets/${matchBullet.id}`]: matchBullet })
  const good = bulletRecord(`catalogue:${matchBullet.id}`)
  const lost = { ...bulletRecord('catalogue:gone-1'), id: '6f0f4d3e-0a43-4a43-9a3d-3a2f2e1f0c12' }
  const views = await userBullets([good, lost, { ...good, kind: 'firearm' } as never])
  expect(views.map((v) => v.id)).toEqual([uuid])
  expect(views[0]?.si.mass).toBeCloseTo(0.011, 9)
  expect(await userCartridges([good, lost])).toEqual([])
})

it('names references: a catalogue record by id or reference, a user record by UUID only', () => {
  expect(catalogueRef('308-win')).toBe('catalogue:308-win')
  expect(catalogueRef('catalogue:308-win')).toBe('catalogue:308-win')
  expect(catalogueIdOf('308-win')).toBe('308-win')
  expect(catalogueIdOf('catalogue:308-win')).toBe('308-win')
  expect(catalogueIdOf(`user:${uuid}`)).toBeUndefined()
  expect(userRef(uuid)).toBe(`user:${uuid}`)
  expect(userRef('old-id-1')).toBeUndefined()
})

it('keeps a load that names a design: it parses with the reference and finds its record', () => {
  const load = {
    kind: 'load',
    id: 'w1',
    name: 'Load',
    saved,
    data: { origin: 'user', bullet: `user:${uuid}`, cartridge: 'catalogue:308-win' },
  }
  const parsed = userRecord.parse(load)
  expect(parsed.kind === 'load' && parsed.data.bullet).toBe(`user:${uuid}`)
  expect(checkUserRefs([parsed, bulletRecord()].map((r) => userRecord.parse(r)))).toEqual([])
  expect(checkUserRefs([parsed])).toHaveLength(1)
})

it('says a base changed only when the revision kept at save differs from the base now', async () => {
  const revised = (revision?: string) => ({ ...matchBullet, ...(revision && { revision }) })
  const data = (basedOnRevision?: string): UserBullet => ({
    ...bulletData(`catalogue:${matchBullet.id}`),
    ...(basedOnRevision && { basedOnRevision }),
  })
  const changed = async (saved: string | undefined, now: string | undefined) => {
    stubApi({ [`bullets/${matchBullet.id}`]: revised(now) })
    return (await resolveBullet(data(saved))).changed
  }
  expect(await changed('aaa', 'bbb')).toBe(true)
  expect(await changed('aaa', 'aaa')).toBe(false)
  // a design saved without a revision, or a base the API answers without one, claims nothing
  expect(await changed(undefined, 'bbb')).toBe(false)
  expect(await changed('aaa', undefined)).toBe(false)
  expect(baseChanged('aaa', { status: 'missing', ref: 'catalogue:gone-1' })).toBe(false)
  expect(baseChanged('aaa', { status: 'none' })).toBe(false)
})

it('says a cartridge base changed from the revision of its record', async () => {
  const record = (revision: string) => ({ ...cartridge308, revision })
  stubApi({ [`cartridges/${cartridge308.id}`]: record('bbb') })
  const data = (basedOnRevision: string) => ({
    origin: 'user' as const,
    basedOn: `catalogue:${cartridge308.id}`,
    basedOnRevision,
  })
  expect((await resolveCartridge(data('aaa'))).changed).toBe(true)
  expect((await resolveCartridge(data('bbb'))).changed).toBe(false)
})

it('keeps listing a design while the API cannot be reached, from the base it read last', async () => {
  stubStorage()
  const good = bulletRecord(`catalogue:${matchBullet.id}`)
  stubApi({ [`bullets/${matchBullet.id}`]: matchBullet })
  expect((await userBullets([good])).map((v) => v.id)).toEqual([uuid])
  stubApi({}, true)
  const [view] = await userBullets([good])
  expect(view?.id).toBe(uuid)
  expect(view?.resolved.base.status).toBe('found')
  expect(view?.resolved.problem).toBeUndefined()
  expect(view?.si.diameter).toBeCloseTo(7.823e-3, 9)
  expect(view?.si.mass).toBeCloseTo(0.011, 9)
})

it('keeps listing a design while the API cannot be reached and the base was never read', async () => {
  stubStorage()
  stubApi({}, true)
  const cartridge = {
    kind: 'cartridge',
    id: uuid,
    name: 'Mine',
    saved,
    data: {
      origin: 'user',
      basedOn: `catalogue:${cartridge308.id}`,
      overrides: { values: [{ side: 'cartridge', symbol: 'L3', quantity: 'length', value: 52 }] },
    },
  } satisfies UserRecord
  const [bullet] = await userBullets([bulletRecord(`catalogue:${matchBullet.id}`)])
  expect(bullet?.resolved.base.status).toBe('unreachable')
  expect(bullet?.si.mass).toBeCloseTo(0.011, 9)
  const [view] = await userCartridges([cartridge])
  expect(view?.resolved.base.status).toBe('unreachable')
  expect(view?.resolved.record.values).toHaveLength(1)
})

it('forgets a base the catalogue no longer has', async () => {
  stubStorage()
  const good = bulletRecord(`catalogue:${matchBullet.id}`)
  stubApi({ [`bullets/${matchBullet.id}`]: matchBullet })
  await userBullets([good])
  stubApi({})
  expect(await userBullets([good])).toEqual([])
  stubApi({}, true)
  expect((await resolveBullet(bulletData(`catalogue:${matchBullet.id}`))).base.status).toBe(
    'unreachable',
  )
})
