// Writes the Pagefind indexes of the built site: the docs pages and one record per operation of the
// REST page (rest/, rendered in the browser, so its HTML has no text to index) to <outDir>/pagefind/,
// the TypeDoc pages (library/) to <outDir>/pagefind-library/. Runs after `docusaurus build`
// (postBuild in the config): `node scripts/search.mts <outDir>`.
import { readdirSync, readFileSync } from 'node:fs'
import { join, sep } from 'node:path'
import * as pagefind from 'pagefind'

/**
 * Main content of each site, `site` its value in the `site` filter of the search box. `weight`
 * scales its words, with the merge weight of the library index (src/theme/SearchBar.tsx).
 */
const roots = [
  { prefix: 'library/', open: '<div class="col-content">', site: 'Library', weight: '0.5' },
  { prefix: '', open: '<div class="theme-doc-markdown markdown">', site: 'Docs', weight: '10' },
]

/** Repeated page parts inside the main content, and the MathML copy of each KaTeX formula. */
const excludeSelectors = ['.katex-mathml', '.hash-link', '.tsd-breadcrumb', '.tsd-sources']

/** The page with its main content marked for Pagefind. Pages without one are not indexed. */
export function marked(path: string, html: string): string {
  const root = roots.find((r) => path.startsWith(r.prefix) && html.includes(r.open))
  if (!root) return html
  const attributes = `data-pagefind-body data-pagefind-filter="site:${root.site}" data-pagefind-weight="${root.weight}"`
  return html.replace(root.open, `${root.open.slice(0, -1)} ${attributes}>`)
}

/** The parts of an OpenAPI document the REST records read. */
interface RestDocument {
  paths: Record<
    string,
    Record<
      string,
      {
        tags?: string[]
        summary?: string
        description?: string
        parameters?: { name: string; description?: string }[]
      }
    >
  >
}

/** One search record per operation, linked to its section on the REST page (`#tag/<tag>/<METHOD><path>`). */
export function restRecords(doc: RestDocument): pagefind.CustomRecord[] {
  return Object.entries(doc.paths).flatMap(([path, operations]) =>
    Object.entries(operations).map(([method, op]) => {
      const tag = (op.tags?.[0] ?? '').toLowerCase().replaceAll(' ', '-')
      const params = (op.parameters ?? []).map((p) => `${p.name} ${p.description ?? ''}`)
      return {
        url: `/rest/#tag/${tag}/${method.toUpperCase()}${path}`,
        content: [op.summary, op.description, ...params].filter(Boolean).join(' '),
        language: 'en',
        meta: { title: `${method.toUpperCase()} ${path}${op.summary ? `: ${op.summary}` : ''}` },
        filters: { site: ['REST API'] },
      }
    }),
  )
}

const htmlFiles = (dir: string): string[] =>
  readdirSync(dir, { recursive: true, encoding: 'utf8' }).filter((f) => f.endsWith('.html'))

/** A new Pagefind index. */
async function createIndex(): Promise<pagefind.PagefindIndex> {
  const { index, errors } = await pagefind.createIndex({ excludeSelectors, forceLanguage: 'en' })
  if (!index) throw new Error(`pagefind: ${errors.join(', ')}`)
  return index
}

/**
 * Indexes the site built into `outDir`. The library has its own index, which the search box merges
 * with a lower weight: its short generated pages, many times the docs pages in number, otherwise
 * rank above the model pages.
 */
async function writeSearchIndex(outDir: string): Promise<void> {
  try {
    const site = await createIndex()
    const library = await createIndex()
    for (const file of htmlFiles(outDir)) {
      const path = file.replaceAll(sep, '/')
      const html = marked(path, readFileSync(join(outDir, file), 'utf8'))
      const index = path.startsWith('library/') ? library : site
      await index.addHTMLFile({ url: `/${path.replace(/index\.html$/, '')}`, content: html })
    }
    const doc = JSON.parse(readFileSync(join(outDir, 'rest/openapi.json'), 'utf8'))
    for (const record of restRecords(doc)) await site.addCustomRecord(record)
    await site.writeFiles({ outputPath: join(outDir, 'pagefind') })
    await library.writeFiles({ outputPath: join(outDir, 'pagefind-library') })
  } finally {
    await pagefind.close()
  }
}

if (import.meta.main) await writeSearchIndex(process.argv[2] ?? 'build')
