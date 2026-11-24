/** The tests of this folder that project `next-chromium` runs on the Start site's next edition: a file's every test, or only the titles listed. */
export const nextParity: readonly { file: string; titles?: readonly string[] }[] = [
  { file: 'bullet-designer-checks.spec.ts' },
  { file: 'bullet-list.spec.ts' },
  { file: 'bullet-photo.spec.ts' },
  {
    file: 'cartridge-designer.spec.ts',
    titles: [
      'a change redraws, is marked with the record value and undoes',
      'a refused input shows its reason at the field and keeps the last drawing',
      'a new cartridge without its base values gives a reason, not an empty page',
      'a change, a check and a refusal move no field and not the drawing',
      'keyboard: arrow keys step the field, no slider, changes are announced',
      'print shows the life-size drawing and the values, not the form',
      'the designer has no axe violation in light and dark, and fits 390 px',
      'the designer shows no load-data notice; the caption says how changes are drawn',
      'a chosen bullet seats at the entered COAL in the designed case, and the seating moves the volume',
      'a design whose base record is gone opens read only with the reason',
    ],
  },
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
  { file: 'designer-drafts.spec.ts' },
  { file: 'designer-layout.spec.ts' },
  { file: 'default-order.spec.ts' },
  { file: 'directory-window.spec.ts' },
  {
    file: 'drawing-face.spec.ts',
    titles: ["the designer's views switch by keyboard, keeping the frame and the axis"],
  },
  {
    file: 'firearm-library.spec.ts',
    titles: [
      'the firearm library searches its table, counts its firearms and offers to clear a search without a match',
      'the firearm table fits a 1280 px window with its row menu, one save status and the strip as high as on the other lists',
      'a record link does not put its loading status in the alert line',
    ],
  },
  { file: 'import-entry.spec.ts' },
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
  {
    file: 'powder-designer.spec.ts',
    titles: [
      'checks the draft against the powder schema at its fields',
      'lists everything a hand-entered burn law lacks at once, in plain words',
      'keeps the draft in the browser and reopens it from the Open menu',
      'has no accessibility violations in light',
      'has no accessibility violations in dark',
    ],
  },
  {
    file: 'powder-tune.spec.ts',
    titles: [
      'the powder designer links to the tuning route, where strings typed without a load say why there is no fit',
      'a saved powder design opens the route with the saved loads that use it',
    ],
  },
  { file: 'primer-records.spec.ts', titles: ['the primer list narrows by search'] },
  {
    file: 'safety.spec.ts',
    titles: [
      'an acceptance of the earlier Safety text asks again',
      'Decline leaves the site for the empty page, naming no other site',
      'at 390 x 640 I accept and Decline are in view without scrolling',
    ],
  },
  { file: 'shooting-log.spec.ts' },
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
    file: 'target-designer.spec.ts',
    titles: [
      'draws the rings at the entered diameters and reports the face usable',
      'has no accessibility violations in light',
      'has no accessibility violations in dark',
    ],
  },
  { file: 'user-data-folder.spec.ts' },
  { file: 'user-data-invalid.spec.ts' },
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
