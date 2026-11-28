// Reads the output of `site:build`: the page's HTML before any script runs, so an embed rendered only in the browser fails
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const html = readFileSync(new URL('../build/interface/index.html', import.meta.url), 'utf8')

test('the interface page holds the embedded field and button in its built HTML', () => {
  assert.match(
    html,
    /<label[^>]*class="[^"]*mantine-TextInput-label[^"]*"[^>]*>Charge \(gr\)<\/label>/,
  )
  assert.match(
    html,
    /<button[^>]*class="[^"]*mantine-Button-root[^"]*"[^>]*>(?:(?!<\/button>).)*Save load/s,
  )
})
