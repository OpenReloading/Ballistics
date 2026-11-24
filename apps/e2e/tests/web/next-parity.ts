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
      '/workbench answers 200, shows its h1 and logs no error',
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
  {
    file: 'workbench-auto-run.spec.ts',
    titles: [
      'a charge change updates the result without Run',
      'an empty charge never starts a run, the result stays marked',
      'a charge below 0 never starts a run, the result stays marked',
      "clearing a revolver's firearm drops its cylinder gap leak and reruns the load",
    ],
  },
  { file: 'workbench-band.spec.ts' },
  { file: 'workbench-cartridge-design.spec.ts' },
  { file: 'workbench-followed-error.spec.ts' },
  { file: 'workbench-layout.spec.ts' },
  { file: 'workbench-link.spec.ts' },
  { file: 'workbench-load-notes.spec.ts' },
  {
    file: 'workbench-load-roundtrip.spec.ts',
    titles: [
      'a saved load reopens with every field as it was and nothing unsaved',
      'a diameter and length typed over the bullet record are saved as typed values and follow the record again when emptied',
      'a load of records keeps the charge and the travel, runs the powder at the start pressure of its fit, and reopens with the records filling the rest',
    ],
  },
  { file: 'workbench-lot-rows.spec.ts' },
  { file: 'workbench-messages.spec.ts' },
  { file: 'workbench-no-scroll.spec.ts' },
  {
    file: 'workbench-notes.spec.ts',
    titles: ['More shows the count, its dialog lists every note, traps the focus and returns it'],
  },
  {
    file: 'workbench-output.spec.ts',
    titles: [
      'the report prints the range with its unit, the inputs with their digits and the main charge',
      'the Print menu leaves out the sections unticked, also on the next visit',
      'the report keeps its chart after the same load runs again',
      'the chart data dialog downloads the curves and the results as CSV',
      'the free recoil shows the momentum of bullet and gas',
      'every interior field says what it is',
      'in German the pressure range keeps its gap and the Powder card its lot',
      'the Powders tab copies its table as CSV and keeps its mode and filters with the saved load',
    ],
  },
  { file: 'workbench-phone.spec.ts' },
  { file: 'workbench-pinned-row.spec.ts' },
  { file: 'workbench-playback.spec.ts' },
  { file: 'workbench-record-reset.spec.ts' },
  { file: 'workbench-sessions.spec.ts' },
  { file: 'workbench-volume-note.spec.ts' },
  { file: 'truing.spec.ts' },
  { file: 'ladder-focus.spec.ts' },
  { file: 'ladder-impact.spec.ts' },
  {
    file: 'session.spec.ts',
    titles: [
      'takes the unit of the file over the unit chosen for files without one',
      'prints the summary without the file control',
      'the example loads into badges, the strings table and a tab per string with a chart',
    ],
  },
  { file: 'tooltip-hover.spec.ts' },
  { file: 'groups-face.spec.ts' },
  {
    file: 'range-mode.spec.ts',
    titles: [
      'two tabs entering shots for one load lose none, and a Save of the load in a tab opened earlier keeps the session',
      'every control fits a thumb at 390 px and the page has no axe violation with a load open',
      'the chosen load names its components, the statistics follow Add shot, and the ladder steps share one width',
    ],
  },
  {
    file: 'workbench-model-inputs.spec.ts',
    titles: [
      'the powder choosers hide powders without burn values until the filter is off, and such a powder cannot run',
    ],
  },
]
