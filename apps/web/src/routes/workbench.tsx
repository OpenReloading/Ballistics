import { createFileRoute } from '@tanstack/react-router'
import { Workbench } from '../components/workbench.tsx'
import { pageHead } from './-page-head.ts'
import { searchOf } from './-search.ts'

export const Route = createFileRoute('/workbench')({
  // a link's records, firearm, result tab, ladder and units; a copied load adds each field's value as its own key
  validateSearch: searchOf(
    'cartridge',
    'bullet',
    'powder',
    'firearm',
    'tab',
    'units',
    'ladderSteps',
    'ladderDirection',
    'ladderKind',
  ),
  head: () =>
    pageHead(
      'Load workbench',
      'Cartridge, bullet, powder and firearm in one view: interior ballistics simulation with a peak pressure range over input tolerances and CIP limit warnings, and the trajectory computed in the browser.',
    ),
  component: Workbench,
})
