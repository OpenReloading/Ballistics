import assert from 'node:assert/strict'
import { test } from 'node:test'
import { marked, restRecords } from './search.mts'

test('the main content of a docs and a library page is indexed with its site, other pages are not', () => {
  const docs = marked(
    'models/m3/index.html',
    '<div class="theme-doc-markdown markdown"><h1>M3</h1></div>',
  )
  assert.match(
    docs,
    /data-pagefind-body data-pagefind-filter="site:Docs" data-pagefind-weight="10">/,
  )
  const library = marked('library/functions/a.html', '<div class="col-content"><h1>a</h1></div>')
  assert.match(
    library,
    /<div class="col-content" data-pagefind-body data-pagefind-filter="site:Library" data-pagefind-weight="0.5">/,
  )
  assert.equal(marked('404.html', '<main>Page not found</main>'), '<main>Page not found</main>')
  // a library page has no docs markup, a docs page under another path has no library markup
  assert.equal(
    marked('a/index.html', '<div class="col-content"></div>'),
    '<div class="col-content"></div>',
  )
})

test('one REST record per operation links to its section on the REST page', () => {
  const records = restRecords({
    paths: {
      '/v1/bullets/{id}': {
        get: {
          tags: ['Records'],
          summary: 'Get a bullet',
          description: 'The whole record.',
          parameters: [{ name: 'id', description: 'Record id' }],
        },
      },
      '/v1/interior': { post: { tags: ['Interior'] } },
    },
  })
  assert.deepEqual(records[0], {
    url: '/rest/#tag/records/GET/v1/bullets/{id}',
    content: 'Get a bullet The whole record. id Record id',
    language: 'en',
    meta: { title: 'GET /v1/bullets/{id}: Get a bullet' },
    filters: { site: ['REST API'] },
  })
  assert.equal(records[1]?.url, '/rest/#tag/interior/POST/v1/interior')
  assert.equal(records[1]?.meta?.title, 'POST /v1/interior')
})
