import { createFileRoute } from '@tanstack/react-router'
import { PowderDesignerLoader } from '../../components/powder-designer-loader.tsx'
import { listHead, listSearch } from '../-list-route.ts'

export const Route = createFileRoute('/powders/designer')({
  validateSearch: listSearch,
  head: () =>
    listHead(
      'Powder designer',
      'Enter the values of a powder record, with its burn-law parameters for the interior model, and have them checked against the powder schema as you type. The powder is kept in your browser and usable in the workbench.',
    ),
  component: PowderDesignerLoader,
})
