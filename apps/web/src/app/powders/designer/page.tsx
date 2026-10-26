import type { Metadata } from 'next'
import { PowderDesignerLoader } from '../../../components/powder-designer-loader.tsx'

export const metadata: Metadata = {
  title: 'Powder designer',
  description:
    'Enter the values of a powder record, with its burn-law parameters for the interior model, and have them checked against the powder schema as you type. The powder is kept in your browser and usable in the workbench.',
}

export default function PowderDesignerPage() {
  return <PowderDesignerLoader />
}
