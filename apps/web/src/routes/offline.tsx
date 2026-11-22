import { createFileRoute } from '@tanstack/react-router'
import { PlaceholderPage } from './-placeholder.tsx'

export const Route = createFileRoute('/offline')({ component: PlaceholderPage })
