import { createFileRoute } from '@tanstack/react-router'
import { BulletDesignerLoader } from '../../components/bullet-designer-loader.tsx'
import { listHead } from '../-list-route.ts'
import { searchOf } from '../-search.ts'

export const Route = createFileRoute('/bullets/designer')({
  validateSearch: searchOf('from', 'record'),
  head: () =>
    listHead(
      'Bullet designer',
      'Enter or change bullet dimensions and see the technical drawing follow, from a caliber and mass or a catalog bullet.',
    ),
  component: BulletDesignerLoader,
})
