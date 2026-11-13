import localFont from 'next/font/local'

/** The drawing text: Inter Regular, self-hosted (OFL.txt); its advances are in packages/svg-drawings/src/core/advances.json. */
export const drawingFont = localFont({
  src: './Inter-Regular.woff2',
  weight: '400',
  display: 'block',
  variable: '--font-drawing',
})
