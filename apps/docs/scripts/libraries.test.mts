import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const docs = fileURLToPath(new URL('../', import.meta.url))
const root = fileURLToPath(new URL('../../../', import.meta.url))
const libraries = ['schema', 'core', 'drawing', 'importers', 'data']

for (const name of libraries) {
  const pkg = `@open-reloading/${name}`
  const page = readFileSync(`${docs}docs/libraries/${name}.md`, 'utf8')

  test(`${name}: install line, entry points, reference link and homepage`, () => {
    const manifest = JSON.parse(readFileSync(`${root}packages/${name}/package.json`, 'utf8'))
    assert.equal(manifest.name, pkg)
    assert.match(page, new RegExp(`\`\`\`sh\\nnpm install ${pkg}\\n\`\`\``))
    for (const entry of Object.keys(manifest.exports))
      assert.ok(page.includes(`| \`${pkg}${entry.slice(1)}\` |`), `entry point ${entry} not listed`)
    assert.ok(page.includes(`(pathname:///library/modules/_open-reloading_${name}.html)`))
    assert.equal(
      manifest.homepage,
      `https://openreloading.github.io/Ballistics/docs/libraries/${name}/`,
    )
  })

  // the example runs from apps/docs, where the workspace packages resolve to their dist/
  test(`${name}: the example prints what its comments say`, () => {
    const example = page.match(/^## Example\n[\s\S]*?```js\n([\s\S]*?)```/m)?.[1]
    assert.ok(example, 'no js block under ## Example')
    const expected = [...example.matchAll(/^console\.log\(.*\) \/\/ (.*)$/gm)].map((m) => m[1])
    assert.ok(expected.length > 0, 'no console.log line with its output')
    const out = execFileSync(process.execPath, ['--input-type=module', '-e', example], {
      cwd: docs,
      encoding: 'utf8',
    })
    assert.deepEqual(out.trimEnd().split('\n'), expected)
  })
}
