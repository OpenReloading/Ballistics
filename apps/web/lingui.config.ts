import { defineConfig } from '@lingui/conf'
import { formatter } from '@lingui/format-po'

// explicit ids only, named after their route: no id flags and no file references to keep in step
export const format = formatter({ explicitIdAsDefault: true, origins: false })

// the Start routes and the views; a view's text not yet on an id stays in src/i18n, read by scripts/i18n.mts
export default defineConfig({
  sourceLocale: 'en',
  locales: ['en', 'de'],
  catalogs: [{ path: '<rootDir>/src/locales/{locale}', include: ['src/routes', 'src/components'] }],
  compileNamespace: 'json',
  format,
})
