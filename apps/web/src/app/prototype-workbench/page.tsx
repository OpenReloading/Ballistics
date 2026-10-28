import '../prototype-workbench.css'
import { Suspense } from 'react'
import { PrototypeWorkbench } from '../../components/prototype-workbench.tsx'

export default function Page() {
  return (
    <Suspense fallback={null}>
      <PrototypeWorkbench />
    </Suspense>
  )
}
