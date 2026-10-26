'use client'

import dynamic from 'next/dynamic'
import { DesignerLoading } from './designer-loader.tsx'

/** The powder designer, loaded in the browser only, apart from the route; its bar is prerendered. */
const Designer = dynamic(() => import('./powder-designer.tsx').then((m) => m.PowderDesigner), {
  ssr: false,
  loading: () => <DesignerLoading title="Powder designer" />,
})

export const PowderDesignerLoader = () => <Designer />
