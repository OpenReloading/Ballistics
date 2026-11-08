import { defineConfig } from '@lingui/conf'
import { formatter } from '@lingui/format-po'

// ui's own messages: English is the source, the build compiles the catalogs to JSON beside them (src/messages.ts)
export default defineConfig({
  sourceLocale: 'en',
  locales: ['en', 'de'],
  catalogs: [{ path: '<rootDir>/src/locales/{locale}', include: ['src'] }],
  compileNamespace: 'json',
  // file references without line numbers, so a code edit leaves the catalogs alone
  format: formatter({ lineNumbers: false }),
})
