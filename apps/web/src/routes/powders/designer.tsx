import { createFileRoute } from '@tanstack/react-router'
import { PowderDesignerLoader } from '../../components/powder-designer-loader.tsx'
import { listHead } from '../-list-route.ts'
import { searchOf } from '../-search.ts'

export const Route = createFileRoute('/powders/designer')({
  validateSearch: searchOf('record'),
  head: () =>
    listHead(
      'Powder designer',
      'Enter the values of a powder record, with its burn-law parameters for the interior model, and have them checked against the powder schema as you type. The powder is kept in your browser and usable in the workbench.',
    ),
  component: PowderDesignerLoader,
})
