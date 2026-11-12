import { createFileRoute } from '@tanstack/react-router'
import { Workbench } from '../../../web/src/components/workbench.tsx'

export const Route = createFileRoute('/workbench')({ component: Workbench })
