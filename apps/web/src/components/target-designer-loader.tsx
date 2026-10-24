'use client'

import dynamic from 'next/dynamic'
import { DesignerLoading } from './designer-loader.tsx'

/** The target face designer, loaded in the browser only, apart from the route; its bar is prerendered. */
const Designer = dynamic(() => import('./target-designer.tsx').then((m) => m.TargetDesigner), {
  ssr: false,
  loading: () => <DesignerLoading title="Target face designer" />,
})

export const TargetDesignerLoader = () => <Designer />
