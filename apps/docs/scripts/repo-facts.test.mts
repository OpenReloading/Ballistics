import assert from 'node:assert/strict'
import { test } from 'node:test'
import { repoFacts } from './repo-facts.mts'

const json = (body: unknown, status = 200) => Response.json(body, { status })

test('stars, forks and the latest release tag, with the token when given', async () => {
  const seen: Record<string, string | undefined> = {}
  const facts = await repoFacts('o/r', 't0k', (url, init) => {
    seen[url] = (init.headers as Record<string, string>).Authorization
    return Promise.resolve(
      url.endsWith('/releases/latest')
        ? json({ tag_name: 'v1.2.0' })
        : json({ stargazers_count: 12, forks_count: 3 }),
    )
  })
  assert.deepEqual(facts, { tag: 'v1.2.0', stars: 12, forks: 3 })
  assert.equal(seen['https://api.github.com/repos/o/r'], 'Bearer t0k')
})

test('without a release the newest tag is used', async () => {
  const facts = await repoFacts('o/r', undefined, (url) =>
    Promise.resolve(
      url.endsWith('/releases/latest')
        ? json({}, 404)
        : url.endsWith('/tags')
          ? json([{ name: 'v0.3.0' }, { name: 'v0.2.0' }])
          : json({ stargazers_count: 1, forks_count: 0 }),
    ),
  )
  assert.deepEqual(facts, { tag: 'v0.3.0', stars: 1, forks: 0 })
})

test('a failing or rate-limited API leaves the facts out and does not throw', async () => {
  assert.deepEqual(await repoFacts('o/r', undefined, () => Promise.resolve(json({}, 403))), {})
  assert.deepEqual(
    await repoFacts('o/r', undefined, () => Promise.reject(new Error('offline'))),
    {},
  )
})
