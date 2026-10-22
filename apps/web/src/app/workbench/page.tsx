import type { Metadata } from 'next'
import { Workbench } from '../../components/workbench.tsx'

export const metadata: Metadata = {
  title: 'Load workbench',
  description:
    'Cartridge, bullet, powder and firearm in one view: interior ballistics simulation with a peak pressure range over input tolerances and CIP limit warnings, and the trajectory computed in the browser.',
}

export default function WorkbenchPage() {
  return <Workbench />
}
