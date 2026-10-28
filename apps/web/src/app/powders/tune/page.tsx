import type { Metadata } from 'next'
import { PowderTuneLoader } from '../../../components/powder-tune-proto-loader.tsx'

export const metadata: Metadata = {
  title: 'Tune a powder (prototype)',
  description:
    'Prototype of the powder tuning screen on synthetic ladders. Simulation, not load data.',
}

export default function PowderTunePage() {
  return <PowderTuneLoader />
}
