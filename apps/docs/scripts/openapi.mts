// Writes the REST reference page to static/rest/ (openapi.json of the current routes, the Scalar viewer scalar.js, the palette tokens.css and the page loading them); needs `pnpm run build` at the root, API_URL is the API its reference sends requests to, unset (GitHub Pages) the page links to none
import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { buildOpenApi } from '@rangefoundry/api/openapi'

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
copyFileSync(
  new URL(import.meta.resolve('@rangefoundry/design-tokens/tokens.css')),
  new URL('tokens.css', out),
)

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
  // the link color of the tokens (tokens.css next to the page)
  customCss: '.light-mode,.dark-mode{--scalar-color-accent:var(--link)}',
}

writeFileSync(
  new URL('index.html', out),
  `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>REST API | RangeFoundry Workbench</title>
    <link rel="stylesheet" href="./tokens.css" />
    <style>
      body { margin: 0; background: var(--surface); }
      .bar { margin: 0; padding: 0.5rem 1rem; font: 14px/1.4 var(--font-family-system); color: var(--ink); background: var(--surface); border-bottom: 1px solid var(--line); }
      .bar a { color: var(--link); }
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
