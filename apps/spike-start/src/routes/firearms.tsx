import { createFileRoute } from '@tanstack/react-router'
import { FirearmLibrary } from '../../../web/src/components/firearm-library.tsx'

export const Route = createFileRoute('/firearms')({ component: FirearmLibrary })
