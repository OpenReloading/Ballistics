import type { SidebarsConfig } from '@docusaurus/plugin-content-docs'

/** A collapsed sidebar category of model pages, `docs/models/<page>.md`. */
const category = (label: string, pages: string[]) => ({
  type: 'category' as const,
  label,
  collapsed: true,
  items: pages.map((page) => `models/${page}`),
})

const sidebars: SidebarsConfig = {
  models: [
    category('Interior', [
      'interior-m3',
      'interior-burn-forms',
      'interior-leakage-heat',
      'interior-shotshell',
      'interior-powder-fit',
      'interior-charge-solver',
      'interior-pressure-range',
      'interior-sampled-band',
      'interior-velocity-ladder',
    ]),
    category('Exterior', [
      'exterior-atmosphere',
      'exterior-drag',
      'exterior-point-mass',
      'exterior-stability',
      'exterior-modified-point-mass',
      'exterior-moving-target',
      'exterior-outline-drag',
      'exterior-truing',
      'exterior-truing-strings',
    ]),
    category('Targets and groups', ['groups', 'hit-probability', 'ring-scoring', 'hole-detection']),
    category('Case and firearm', ['case-capacity', 'bullet-fit', 'free-recoil']),
    'models/least-squares',
  ],
  data: [
    'data/federations',
    'data/manufacturers',
    'data/record-model',
    'data/firearm-records',
    'bibliography',
  ],
  contributing: ['release', 'ci-tools'],
}

export default sidebars
