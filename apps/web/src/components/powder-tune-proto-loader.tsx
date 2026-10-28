'use client'

import dynamic from 'next/dynamic'
import { DesignerLoading } from './designer-loader.tsx'

const Screen = dynamic(() => import('./powder-tune-proto.tsx').then((m) => m.PowderTuneProto), {
  ssr: false,
  loading: () => <DesignerLoading title="Tune a powder" />,
})

export const PowderTuneLoader = () => <Screen />
