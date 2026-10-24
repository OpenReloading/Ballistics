import { checkUserRefs, type UserBullet, type UserRecord, userRecord } from '@openreloading/schema'
import { afterEach, expect, it, vi } from 'vitest'
import {
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

afterEach(() => vi.unstubAllGlobals())

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
  manufacturerName: 'Me',
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
    kind: 'workbenchState',
    id: 'w1',
    name: 'Load',
    saved,
    data: { siValues: {}, bullet: `user:${uuid}`, cartridge: '308-win' },
  }
  const parsed = userRecord.parse(load)
  expect(parsed.kind === 'workbenchState' && parsed.data.bullet).toBe(`user:${uuid}`)
  expect(checkUserRefs([parsed, bulletRecord()].map((r) => userRecord.parse(r)))).toEqual([])
  expect(checkUserRefs([parsed])).toHaveLength(1)
})
