/** The tests of this folder that project `next-chromium` runs on the Start site's next edition: a file's every test, or only the titles listed. */
export const nextParity: readonly { file: string; titles?: readonly string[] }[] = [
  { file: 'bullet-list.spec.ts' },
  {
    file: 'cartridges.spec.ts',
    titles: [
      'the list searches names and aliases and keeps the search in the URL',
      'the source filter names the sources shown, keeps them in the URL and one stays on',
      'a search without a match offers to clear the filters',
      'the tick box of a row is at least 24 px, as the row keeps its height',
      'the list sorts by L3 through its header button',
      'at 1280 x 800 the cartridge table is the only scroll box',
      'at 1920 x 1080 the cartridge table is the only scroll box',
      'at 390 px a cartridge row is the name over a facts line',
      'the cartridge list prints the selection, capped and said so',
      'printed on A4, a name with its aliases takes at most two lines',
      'the Case type column has no help note',
    ],
  },
  { file: 'competition-events.spec.ts' },
  { file: 'default-order.spec.ts' },
  { file: 'directory-window.spec.ts' },
  {
    file: 'list-filters.spec.ts',
    titles: [
      'a discipline filtered by federation and a distance in yards survives a reload and clears',
      'the federation list links each federation to its record',
      'the brass list links each case to its record',
    ],
  },
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
  { file: 'offline-page.spec.ts' },
  { file: 'primer-records.spec.ts', titles: ['the primer list narrows by search'] },
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
      '/targets answers 200, shows its h1 and logs no error',
      '/disciplines answers 200, shows its h1 and logs no error',
      '/federations answers 200, shows its h1 and logs no error',
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
