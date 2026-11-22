import { PageBar } from '@rangefoundry/ui'
import { createFileRoute } from '@tanstack/react-router'

const HomePage = () => <PageBar title="RangeFoundry Workbench" />

export const Route = createFileRoute('/')({ component: HomePage })
