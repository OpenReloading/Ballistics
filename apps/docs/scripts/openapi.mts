// Writes the REST reference page to static/rest/: the contract document of the current routes
// (openapi.json), the Scalar viewer from node_modules (scalar.js) and the page that loads both.
// Needs `npm run build` at the root (the API is imported from its dist). API_URL is the API whose
// own reference sends requests. Unset (no API, as on GitHub Pages): the page links to none.
import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { buildOpenApi } from '@open-reloading/api/openapi'

const out = new URL('../static/rest/', import.meta.url)
const api = process.env.API_URL?.replace(/\/$/, '')
const reference = api
  ? ` · Send requests from the API's own reference: <a href="${api}/v1/reference/">${api}/v1/reference/</a>`
  : ''

mkdirSync(out, { recursive: true })
writeFileSync(new URL('openapi.json', out), `${JSON.stringify(await buildOpenApi(), null, 2)}\n`)
// the package exports no path to its browser build: it sits next to its entry, dist/index.js
const scalar = new URL('browser/standalone.js', import.meta.resolve('@scalar/api-reference'))
copyFileSync(scalar, new URL('scalar.js', out))

/** The viewer reads the document only: no requests, no fonts, chat or telemetry from other origins. */
const configuration = {
  url: './openapi.json',
  hideTestRequestButton: true,
  hideClientButton: true,
  hideDarkModeToggle: true,
  withDefaultFonts: false,
  telemetry: false,
  agent: { disabled: true },
  mcp: { disabled: true },
  showDeveloperTools: 'never',
  documentDownloadType: 'json',
  // the primary colors of the docs site, the link blue of the web app
  customCss: '.light-mode{--scalar-color-accent:#0b57d0}.dark-mode{--scalar-color-accent:#8ab4f8}',
}

writeFileSync(
  new URL('index.html', out),
  `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>REST API | OpenReloading Ballistics</title>
    <style>
      :root { --bar-bg: #f2f4f7; --bar-fg: #1a1a1a; --bar-line: #c9cfd8; --bar-link: #0b57d0; }
      :root[data-theme='dark'] { --bar-bg: #20242b; --bar-fg: #ececec; --bar-line: #3d434d; --bar-link: #8ab4f8; }
      body { margin: 0; background: var(--bar-bg); }
      .bar { margin: 0; padding: 0.5rem 1rem; font: 14px/1.4 system-ui, sans-serif; color: var(--bar-fg); background: var(--bar-bg); border-bottom: 1px solid var(--bar-line); }
      .bar a { color: var(--bar-link); }
    </style>
    <script>
      // the color mode of the docs site (its "theme" key), else the system's
      let stored = null
      try { stored = localStorage.getItem('theme') } catch {}
      const dark = stored ? stored === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches
      document.documentElement.dataset.theme = dark ? 'dark' : 'light'
    </script>
  </head>
  <body>
    <p class="bar"><a href="../">Docs</a>${reference}</p>
    <div id="app"></div>
    <script src="./scalar.js"></script>
    <script>
      Scalar.createApiReference('#app', {
        ...${JSON.stringify(configuration)},
        forceDarkModeState: document.documentElement.dataset.theme,
      })
    </script>
  </body>
</html>
`,
)
