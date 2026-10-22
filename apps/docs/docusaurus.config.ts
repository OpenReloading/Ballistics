import { execFileSync } from 'node:child_process'
import type * as Preset from '@docusaurus/preset-classic'
import type { Config } from '@docusaurus/types'
import rehypeKatex from 'rehype-katex'
import remarkMath from 'remark-math'

const baseUrl = process.env.DOCS_BASE_URL ?? '/'
// the web app the navbar links to: a full URL (a path would resolve under baseUrl); no link when unset
const appUrl = process.env.APP_URL

const config: Config = {
  title: 'OpenReloading Ballistics',
  tagline: 'Documentation',
  // GitHub Pages: DOCS_URL is the site origin, DOCS_BASE_URL the path of the docs ("/repository/docs/")
  url: process.env.DOCS_URL ?? 'https://openreloading.github.io',
  baseUrl,
  onBrokenLinks: 'throw',
  onBrokenAnchors: 'throw',
  // .md files are plain Markdown, .mdx files are MDX
  markdown: { format: 'detect', hooks: { onBrokenMarkdownLinks: 'throw' } },
  stylesheets: [`${baseUrl}pagefind/pagefind-component-ui.css`],
  // the search box of src/theme/SearchBar.tsx: it reads the index next to this script
  scripts: [{ src: `${baseUrl}pagefind/pagefind-component-ui.js`, defer: true }],
  presets: [
    [
      'classic',
      {
        docs: {
          routeBasePath: '/',
          sidebarPath: './sidebars.ts',
          remarkPlugins: [remarkMath],
          rehypePlugins: [rehypeKatex],
          breadcrumbs: true,
        },
        blog: false,
        theme: { customCss: './src/css/custom.css' },
      } satisfies Preset.Options,
    ],
  ],
  // the search index of the built site, docs and both reference sites (scripts/search.mts), in
  // its own process: the config loader cannot require the ESM-only pagefind package
  plugins: [
    ({ siteDir }) => ({
      name: 'search-index',
      postBuild: ({ outDir }) => {
        execFileSync(process.execPath, ['scripts/search.mts', outDir], {
          cwd: siteDir,
          stdio: 'inherit',
        })
      },
    }),
  ],
  themeConfig: {
    navbar: {
      title: 'OpenReloading Ballistics',
      items: [
        { type: 'docSidebar', sidebarId: 'models', label: 'Models', position: 'left' },
        { type: 'docSidebar', sidebarId: 'data', label: 'Data', position: 'left' },
        { type: 'docSidebar', sidebarId: 'contributing', label: 'Contributing', position: 'left' },
        // static sites outside the docs routes: TypeDoc (static/library/, typedoc.config.mjs) and the
        // REST page (static/rest/, scripts/openapi.mts)
        { to: 'pathname:///library/', label: 'Library', position: 'left', target: '_self' },
        { to: 'pathname:///rest/', label: 'REST API', position: 'left', target: '_self' },
        ...(appUrl
          ? [{ href: appUrl, label: 'Web app', position: 'right' as const, target: '_self' }]
          : []),
        { type: 'search', position: 'right' },
      ],
    },
    docs: { sidebar: { hideable: true, autoCollapseCategories: true } },
    colorMode: { respectPrefersColorScheme: true },
  } satisfies Preset.ThemeConfig,
}

export default config
