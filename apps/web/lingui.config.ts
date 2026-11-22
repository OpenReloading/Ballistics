import { defineConfig } from '@lingui/conf'
import { formatter } from '@lingui/format-po'

// only the Start routes use Lingui: the Next app's messages stay in src/i18n, read by scripts/i18n.mts
export default defineConfig({
  sourceLocale: 'en',
  locales: ['en', 'de'],
  catalogs: [{ path: '<rootDir>/src/locales/{locale}', include: ['src/routes'] }],
  compileNamespace: 'json',
  // explicit ids only, named after their route: no id flags and no file references to keep in step
  format: formatter({ explicitIdAsDefault: true, origins: false }),
})
