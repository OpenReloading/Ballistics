const path = require('node:path')

/** A workspace package as the resolver reports it: its folder once built, its name when unbuilt. */
const pkg = (name) => `(packages/${name}/|@open-reloading/${name}(/|$))`
/** Any workspace package or app. */
const workspace = '^(packages/|apps/|@open-reloading/)'
const own = (dir) => `^${dir}/`

/** `to` side of a rule: an import of a workspace package other than the ones listed. */
const workspaceExcept = (dir, ...allowed) => ({
  path: workspace,
  pathNot: `^(${[`${dir}/`, ...allowed.map((name) => pkg(name))].join('|')})`,
})

const drawing = 'packages/drawing/src'
/** Source files at the root of `drawing` count as its core. */
const drawingCore = `${drawing}/(core/|[^/]+\\.ts$)`
/** The entry points each source folder of `drawing` may import from. */
const drawingFolders = {
  core: ['core'],
  cartridge: ['core', 'cartridge'],
  bullet: ['core', 'bullet'],
  seating: ['core', 'cartridge', 'bullet', 'seating'],
  target: ['target'],
}
const drawingFolder = (name) => (name === 'core' ? drawingCore : `${drawing}/${name}/`)

module.exports = {
  forbidden: [
    {
      name: 'not-to-unresolvable',
      severity: 'error',
      comment:
        'An import the resolver cannot follow, which no other rule could judge. Build the workspace packages first.',
      from: {},
      to: { couldNotResolve: true },
    },
    {
      name: 'core-imports-nothing',
      severity: 'error',
      comment:
        'packages/core has no I/O: it imports only its own files. A runtime dependency under the rule of AGENTS.md is allowed here by name.',
      from: { path: own('packages/core/src') },
      to: { pathNot: own('packages/core/src') },
    },
    ...Object.entries(drawingFolders).map(([name, may]) => ({
      name: `drawing-${name}-imports`,
      severity: 'error',
      comment: `packages/drawing has no I/O, no React, DOM or Next.js. Its ${name} folder imports only the folders ${may.join(', ')}.`,
      from: { path: `^${drawingFolder(name)}` },
      to: { pathNot: `^(${may.map(drawingFolder).join('|')})` },
    })),
    {
      name: 'importers-imports-schema-only',
      severity: 'error',
      comment:
        'packages/importers has no I/O and imports nothing but @open-reloading/schema and its own files.',
      from: { path: own('packages/importers/src') },
      to: { pathNot: `^(packages/importers/src/|${pkg('schema')})` },
    },
    {
      name: 'importers-schema-for-types-only',
      severity: 'error',
      comment:
        'packages/importers uses @open-reloading/schema for types only. The compiled files hold no type import, so any import of schema there is a runtime one.',
      from: { path: own('packages/importers/dist') },
      to: { path: pkg('schema') },
    },
    {
      name: 'schema-imports-no-workspace-package',
      severity: 'error',
      comment: 'packages/schema is the bottom of the graph: it imports no other workspace package.',
      from: { path: own('packages/schema/src') },
      to: workspaceExcept('packages/schema/src'),
    },
    {
      name: 'data-imports-schema-only',
      severity: 'error',
      comment: 'packages/data depends on @open-reloading/schema alone.',
      from: { path: own('packages/data/src') },
      to: workspaceExcept('packages/data/src', 'schema'),
    },
    {
      name: 'api-imports-core-data-schema-only',
      severity: 'error',
      comment: 'packages/api depends on core, data and schema.',
      from: { path: own('packages/api/src') },
      to: workspaceExcept('packages/api/src', 'core', 'data', 'schema'),
    },
    {
      name: 'cli-imports-core-data-drawing-schema-only',
      severity: 'error',
      comment:
        'packages/cli is a thin layer over the libraries: it depends on core, data, drawing and schema, and of @open-reloading/api only on the compute and catalogue entries the browser runs, never on the server or the web app.',
      from: { path: own('packages/cli/src') },
      to: {
        path: workspace,
        pathNot: `^(packages/cli/src/|${['core', 'data', 'drawing', 'schema'].map(pkg).join('|')}|packages/api/dist/(compute|catalogue)/browser\\.js$|@open-reloading/api/(compute|catalogue)$)`,
      },
    },
    {
      name: 'web-no-node-builtins',
      severity: 'error',
      comment:
        'apps/web sources run in the browser or in route handlers that read the API: no node: modules. The news loader runs only in the prerender of the static export, which reads the news folder.',
      from: { path: own('apps/web/src'), pathNot: '^apps/web/src/lib/news\\.ts$' },
      to: { dependencyTypes: ['core'] },
    },
    {
      name: 'web-reads-api-only',
      severity: 'error',
      comment:
        'apps/web reads records through the API. Of @open-reloading/data only the plausibility checks and of @open-reloading/api only the compute and catalogue entries of the static site run in the web app.',
      from: { path: own('apps/web/src') },
      to: {
        path: `^(${pkg('data')}|${pkg('api')}|(node_modules/)?(@fastify/|fastify(/|$)))`,
        pathNot:
          '^(packages/data/dist/plausibility\\.js|@open-reloading/data/plausibility|packages/api/dist/(compute|catalogue)/browser\\.js|@open-reloading/api/(compute|catalogue)$)',
      },
    },
  ],
  options: {
    // declaration files hold type imports the compiled-file rule must not see
    exclude: { path: '\\.d\\.ts$' },
    doNotFollow: { path: '(^|/)node_modules/|^packages/(?!importers/)[^/]+/dist/' },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'default'],
    },
    // the `@/` alias of apps/web/tsconfig.json
    webpackConfig: { fileName: path.join(__dirname, '.dependency-cruiser-alias.cjs') },
  },
}
