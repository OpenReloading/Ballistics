import { createFileRoute } from '@tanstack/react-router'
import { BulletDesignerLoader } from '../../../../web/src/components/bullet-designer-loader.tsx'

export const Route = createFileRoute('/bullets/designer')({ component: BulletDesignerLoader })
