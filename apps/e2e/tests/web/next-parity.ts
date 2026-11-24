/** The tests of this folder that project `next-chromium` runs on the Start site's next edition: a file's every test, or only the titles listed. */
export const nextParity: readonly { file: string; titles?: readonly string[] }[] = [
  { file: 'bullet-list.spec.ts' },
  { file: 'bullet-record-compare.spec.ts' },
  { file: 'burn-rates.spec.ts' },
  { file: 'cartridges.spec.ts' },
  {
    file: 'case-records.spec.ts',
    titles: [
      'the case list opens a case record with its cartridge',
      'a primer record shows its properties as Quantity, Value and Unit across the page',
    ],
  },
  { file: 'competition-events.spec.ts' },
  { file: 'component-records.spec.ts' },
  { file: 'default-order.spec.ts' },
  { file: 'directory-window.spec.ts' },
  { file: 'drawing-baseline.spec.ts' },
  { file: 'list-filters.spec.ts' },
  {
    file: 'navigation.spec.ts',
    titles: [
      'an unknown path answers 404 with the section links',
      'a record id the catalogue does not hold, as after its removal, answers 404 with the not-found page',
    ],
  },
  {
    file: 'home-continue.spec.ts',
    titles: [
      'at 1280 x 650 the Continue line moves nothing, with saved loads',
      'at 1280 x 650 the Continue line moves nothing, without saved loads',
      'at 390 x 844 the Continue line moves nothing, with saved loads',
      'at 390 x 844 the Continue line moves nothing, without saved loads',
      'at 1280 x 650 the keyboard order of the home page equals its visual order',
      'at 390 x 844 the keyboard order of the home page equals its visual order',
    ],
  },
  {
    file: 'language.spec.ts',
    titles: ['the Database list and a record page show in German'],
  },
  { file: 'offline-page.spec.ts' },
  {
    file: 'powder-list.spec.ts',
    titles: ["adds the browser's own powder to the burn-rate overlay, marked as a user design"],
  },
  { file: 'powder-record.spec.ts' },
  {
    file: 'primer-records.spec.ts',
    titles: [
      'the primer list opens a primer record with its properties and sources',
      'the primer list narrows by search',
    ],
  },
  {
    file: 'record-page.spec.ts',
    // the offline tests need the service worker, which the Start app gets later
    titles: [
      'cartridges',
      'bullets',
      'powders',
      'cases',
      'primers',
      'targets',
      'disciplines',
      'federations',
    ].flatMap((kind) => [
      `${kind} the exported file carries the record's own head tags and nothing of its content`,
      `${kind} a record whose data file is gone shows the not-found message`,
    ]),
  },
  {
    file: 'safety.spec.ts',
    titles: [
      'an acceptance of the earlier Safety text asks again',
      'Decline leaves the site for the empty page, naming no other site',
      'at 390 x 640 I accept and Decline are in view without scrolling',
    ],
  },
  {
    file: 'smoke.spec.ts',
    titles: [
      '/ answers 200, shows its h1 and logs no error',
      '/cartridges/308-win answers 200, shows its h1 and logs no error',
      '/targets answers 200, shows its h1 and logs no error',
      '/targets/issf-25m-precision-50m-pistol answers 200, shows its h1 and logs no error',
      '/disciplines answers 200, shows its h1 and logs no error',
      '/disciplines/dsb-25m-pistole-revolver answers 200, shows its h1 and logs no error',
      '/federations answers 200, shows its h1 and logs no error',
      '/federations/dsb answers 200, shows its h1 and logs no error',
      'a record page opens another without a page load, back and forward too',
    ],
  },
  {
    file: 'theme.spec.ts',
    titles: [
      'with nothing stored the system setting decides',
      'the switch overrides the system setting and the choice survives a reload',
      'a stored dark applies before the first paint',
      'the switch is reachable by keyboard and exposes its name and pressed state',
      'the header shows the light wordmark as the home link',
      'the header shows the dark wordmark as the home link',
    ],
  },
]
