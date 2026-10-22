import type { Metadata } from 'next'
import { BulletDesignerLoader } from '../../../components/bullet-designer-loader.tsx'

export const metadata: Metadata = {
  title: 'Bullet designer',
  description:
    'Enter or change bullet dimensions and see the technical drawing follow, from a caliber and mass or a catalog bullet.',
}

export default function BulletDesignerPage() {
  return <BulletDesignerLoader />
}
