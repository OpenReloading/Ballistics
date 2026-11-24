import { createFileRoute } from '@tanstack/react-router'
import { BulletDesignerLoader } from '../../components/bullet-designer-loader.tsx'
import { listHead, listSearch } from '../-list-route.ts'

export const Route = createFileRoute('/bullets/designer')({
  validateSearch: listSearch,
  head: () =>
    listHead(
      'Bullet designer',
      'Enter or change bullet dimensions and see the technical drawing follow, from a caliber and mass or a catalog bullet.',
    ),
  component: BulletDesignerLoader,
})
