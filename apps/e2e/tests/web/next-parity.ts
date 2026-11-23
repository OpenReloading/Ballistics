/** The tests of this folder that project `next-chromium` runs on the Start site's next edition: a file's every test, or only the titles listed. */
export const nextParity: readonly { file: string; titles?: readonly string[] }[] = [
  {
    file: 'navigation.spec.ts',
    titles: [
      'an unknown path answers 404 with the section links',
      'a record id the catalogue does not hold, as after its removal, answers 404 with the not-found page',
    ],
  },
  { file: 'offline-page.spec.ts' },
  {
    file: 'safety.spec.ts',
    titles: [
      'an acceptance of the earlier Safety text asks again',
      'Decline leaves the site for the empty page, naming no other site',
      'at 390 x 640 I accept and Decline are in view without scrolling',
    ],
  },
  { file: 'smoke.spec.ts', titles: ['/ answers 200, shows its h1 and logs no error'] },
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
