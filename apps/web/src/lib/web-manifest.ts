/** The web app manifest of the site at `basePath`; the logo is full-bleed, so it is maskable too. */
export function webManifest(basePath: string) {
  const icons = [
    { src: `${basePath}/icon-192.png`, sizes: '192x192', type: 'image/png' },
    { src: `${basePath}/icon.png`, sizes: '512x512', type: 'image/png' },
  ]
  return {
    name: 'RangeFoundry Workbench',
    short_name: 'Workbench',
    description: 'A ballistics database with interior and exterior ballistics simulations.',
    id: `${basePath}/`,
    start_url: `${basePath}/`,
    scope: `${basePath}/`,
    display: 'standalone' as const,
    background_color: '#ffffff',
    theme_color: '#ffffff',
    icons: [
      ...icons.map((i) => ({ ...i, purpose: 'any' as const })),
      ...icons.map((i) => ({ ...i, purpose: 'maskable' as const })),
    ],
  }
}
