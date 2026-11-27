import { defineConfig } from '@lingui/conf'
import { formatter } from '@lingui/format-po'

// explicit ids only, named after their route or shared component: no id flags and no file references to keep in step
export const format = formatter({ explicitIdAsDefault: true, origins: false })

const table = ['src/lib/core-message-table.ts', 'src/lib/refusal-words.ts']

// Lingui's default order (English text, then context) with the id breaking ties: extraction order varies between runs
const collator = new Intl.Collator('en-US')

// the Start routes, the views and their helpers; a view's text not yet on an id stays in src/i18n, read by scripts/i18n.mts
export default defineConfig({
  sourceLocale: 'en',
  locales: ['en', 'de'],
  catalogs: [
    {
      path: '<rootDir>/src/locales/{locale}',
      include: ['src/routes', 'src/components', 'src/lib'],
      exclude: table,
    },
    // the package and API messages, which English pages never read: loaded only with another language
    { path: '<rootDir>/src/locales/table/{locale}', include: table },
  ],
  orderBy: (a, b) =>
    collator.compare(a.entry.message ?? '', b.entry.message ?? '') ||
    collator.compare(a.entry.context ?? '', b.entry.context ?? '') ||
    collator.compare(a.messageId, b.messageId),
  compileNamespace: 'json',
  format,
})
