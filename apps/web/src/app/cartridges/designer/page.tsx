import type { Metadata } from 'next'
import { CartridgeDesignerLoader } from '../../../components/cartridge-designer-loader.tsx'

export const metadata: Metadata = {
  title: 'Cartridge designer',
  description:
    'Change cartridge and chamber dimensions by their CIP symbols and see the technical drawing and the checks follow, from scratch or from a CIP record.',
}

export default function CartridgeDesignerPage() {
  return <CartridgeDesignerLoader />
}
