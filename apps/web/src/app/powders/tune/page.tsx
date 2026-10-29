import type { Metadata } from 'next'
import { PowderTuneLoader } from '../../../components/powder-tune-loader.tsx'

export const metadata: Metadata = {
  title: 'Tune a powder',
  description:
    'Chronograph strings of a saved load or typed in, with mean, standard deviation and shot count per charge, to fit a powder to.',
}

export default function PowderTunePage() {
  return <PowderTuneLoader />
}
