'use client'

import dynamic from 'next/dynamic'
import { loadEnglish } from '../i18n/lingui.ts'
import englishMessages from '../locales/en/components/powder-designer-loader.json' with {
  type: 'json',
}
import { DesignerLoading } from './designer-loader.tsx'

loadEnglish(englishMessages)

/** The powder designer, loaded in the browser only, apart from the route; its bar is prerendered. */
const Designer = dynamic(() => import('./powder-designer.tsx').then((m) => m.PowderDesigner), {
  ssr: false,
  loading: () => (
    <DesignerLoading title={/*i18n*/ { id: 'page.powdersDesigner', message: 'Powder designer' }} />
  ),
})

export const PowderDesignerLoader = () => <Designer />
