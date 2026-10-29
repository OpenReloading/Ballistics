'use client'

import dynamic from 'next/dynamic'
import { msg } from '../i18n/translate.ts'
import { DesignerLoading } from './designer-loader.tsx'

/** The powder tuning screen, loaded in the browser only, apart from the route; its bar is prerendered. */
const Screen = dynamic(() => import('./powder-tune.tsx').then((m) => m.PowderTune), {
  ssr: false,
  loading: () => <DesignerLoading title={msg('Tune a powder')} />,
})

export const PowderTuneLoader = () => <Screen />
