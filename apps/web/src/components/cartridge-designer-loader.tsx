'use client'

import dynamic from 'next/dynamic'
import { DesignerLoading } from './designer-loader.tsx'

/** The cartridge designer, loaded in the browser only, apart from the route; its bar is prerendered. */
const Designer = dynamic(
  () => import('./cartridge-designer.tsx').then((m) => m.CartridgeDesigner),
  {
    ssr: false,
    loading: () => <DesignerLoading title="Cartridge designer" />,
  },
)

export const CartridgeDesignerLoader = () => <Designer />
