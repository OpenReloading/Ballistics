import { createFileRoute } from '@tanstack/react-router'
import { CartridgeDesignerLoader } from '../../components/cartridge-designer-loader.tsx'
import { listHead, listSearch } from '../-list-route.ts'

export const Route = createFileRoute('/cartridges/designer')({
  validateSearch: listSearch,
  head: () =>
    listHead(
      'Cartridge designer',
      'Change cartridge and chamber dimensions by their CIP symbols and see the technical drawing and the checks follow, from scratch or from a CIP record.',
    ),
  component: CartridgeDesignerLoader,
})
