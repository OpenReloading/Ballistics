'use client'

import dynamic from 'next/dynamic'
import { msg } from '../i18n/translate.ts'
import { DesignerLoading } from './designer-loader.tsx'

/** The bullet designer, loaded in the browser only, apart from the route; its bar is prerendered. */
const Designer = dynamic(() => import('./bullet-designer.tsx').then((m) => m.BulletDesigner), {
  ssr: false,
  loading: () => <DesignerLoading title={msg('Bullet designer')} />,
})

export const BulletDesignerLoader = () => <Designer />
