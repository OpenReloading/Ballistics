/** The TypeDoc site of the six packages; its Docs link is the site root (`DOCS_BASE_URL`, as docusaurus.config.ts). */
export default {
  entryPointStrategy: 'packages',
  entryPoints: [
    '../../packages/schema',
    '../../packages/core',
    '../../packages/drawing',
    '../../packages/importers',
    '../../packages/data',
    '../../packages/api',
  ],
  name: 'OpenReloading Ballistics library',
  readme: 'library.md',
  out: 'static/library',
  disableSources: true,
  navigationLinks: { Docs: process.env.DOCS_BASE_URL ?? '/' },
}
