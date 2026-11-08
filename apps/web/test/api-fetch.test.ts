import { describe, expect, it, vi } from 'vitest'

const refusal = {
  statusCode: 422,
  error: 'Unprocessable Entity',
  message: 'ladderChargeBelowZero',
  code: 'ladderChargeBelowZero',
  params: { charge: -0.0012 },
}

vi.mock('../src/lib/static-api.ts', () => ({
  staticFetch: async () => Response.json(refusal, { status: 422 }),
}))

const { apiFetch } = await import('../src/lib/api-fetch.ts')

describe('apiFetch', () => {
  it('gives a typed refusal its English sentence as the message', async () => {
    const res = await apiFetch('interior', { method: 'POST' })
    expect(res.status).toBe(422)
    expect(await res.json()).toEqual({
      ...refusal,
      message: 'ladder charge -0.0012 kg must be above 0',
    })
  })
})
