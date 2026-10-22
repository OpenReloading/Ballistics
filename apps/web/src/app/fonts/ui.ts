import localFont from 'next/font/local'

/**
 * Interface text: the drawing's Inter Regular file (shared download) and Inter SemiBold for
 * headings, buttons and labels (600 and up, no synthesized bold); a fallback shows until they load.
 */
export const uiFont = localFont({
  src: [
    { path: './Inter-Regular.woff2', weight: '400' },
    { path: './Inter-SemiBold.woff2', weight: '600' },
  ],
  display: 'swap',
  variable: '--font-ui',
})
