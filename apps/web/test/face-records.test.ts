import { expect, it, vi } from 'vitest'
import { apiFetch } from '../src/lib/api-fetch.ts'
import { isFaceId } from '../src/lib/face-records.ts'

vi.mock('../src/lib/api-fetch.ts', () => ({ apiFetch: vi.fn() }))

it('knows a face id only from a fetched face list', async () => {
  const fetchMock = vi.mocked(apiFetch)
  fetchMock.mockResolvedValueOnce(new Response(null, { status: 503 }))
  expect(await isFaceId('issf-10m-air-rifle')).toBe(false)
  fetchMock.mockResolvedValueOnce(
    Response.json({
      items: [{ id: 'issf-10m-air-rifle', organization: 'issf', name: 'Air rifle' }],
    }),
  )
  expect(await isFaceId('issf-10m-air-rifle')).toBe(true)
  expect(await isFaceId('no-such-face')).toBe(false)
})
