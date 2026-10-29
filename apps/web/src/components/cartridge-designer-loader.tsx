'use client'

import dynamic from 'next/dynamic'
import { msg } from '../i18n/translate.ts'
import { DesignerLoading } from './designer-loader.tsx'

/** The cartridge designer, loaded in the browser only, apart from the route; its bar is prerendered. */
const Designer = dynamic(
  () => import('./cartridge-designer.tsx').then((m) => m.CartridgeDesigner),
  {
    ssr: false,
    loading: () => <DesignerLoading title={msg('Cartridge designer')} />,
  },
)

export const CartridgeDesignerLoader = () => <Designer />
