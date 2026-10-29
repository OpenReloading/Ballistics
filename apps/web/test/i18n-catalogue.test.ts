import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { compare, extract, messages } from '../scripts/i18n.mts'
import de from '../src/i18n/de.json'
import terms from '../src/i18n/german-terms.json'

const source = messages()
const fold = (s: string) =>
  s
    .toLowerCase()
    .replace(/ä/g, 'a')
    .replace(/ö/g, 'o')
    .replace(/ü/g, 'u')
    .replace(/ß/g, 'ss')
    .replace(/\u00ad/g, '') // a soft hyphen marks where a long compound may break
const placeholders = (s: string) =>
  [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1] ?? '').sort((a, b) => a.localeCompare(b))

describe('message extraction', () => {
  const head = "import { msg, useTranslation } from '../i18n/language.ts'\n"

  it('reads the literals of t, msg and tn, and the key of a plural', () => {
    expect(
      extract(
        `${head}t('A'); t("B \\"q\\""); msg(\`C\`); tn(rows.length, '{count} row', '{count} rows')\n` +
          `tn(\n  f(a, b),\n  'one',\n  'other',\n  { x: 1 },\n)`,
      ),
    ).toEqual(['A', 'B "q"', 'C', '{count} row|{count} rows', 'one|other'])
  })

  it('reads escapes as JavaScript does, so the key equals the runtime string', () => {
    const source = String.raw`${head}t('Line\nTwo'); t("Tab\there \x41 ä \u{1F600} \\ \'")`
    expect(extract(source)).toEqual(['Line\nTwo', "Tab\there A ä \u{1F600} \\ '"])
  })

  it('leaves `t(label)` of a marked message to the place that marks it', () => {
    expect(extract(`${head}t(label)`)).toEqual([])
  })

  it('refuses a msg or a plural without literals', () => {
    expect(() => extract(`${head}msg(name)`)).toThrow(/msg\(\) takes string literals/)
    expect(() => extract(`${head}tn(n, one, 'other')`)).toThrow(/tn\(\) takes string literals/)
    expect(() => extract(`${head}msg(\`a \${b}\`)`)).toThrow(/source:2: msg\(\)/)
  })

  it('reads a file of the i18n folder that imports the translate module', () => {
    expect(extract("import { type Translator } from './translate.ts'\nt('A')")).toEqual(['A'])
  })

  it('reads no file that does not import from i18n', () => {
    expect(extract("const t = (x) => x; t('A')")).toEqual([])
  })

  it('finds the messages of the sources', () => {
    expect(source).toContain('Settings')
    expect(source).toContain('{count} record|{count} records')
  })
})

const catalogues = readdirSync(new URL('../src/i18n', import.meta.url))
  .filter((f) => /^[a-z]{2,3}\.json$/.test(f))
  .map((f) => f.replace('.json', ''))

describe.each(catalogues)('catalogue %s', (code) => {
  const catalogue: Record<string, string | Record<string, string>> = JSON.parse(
    readFileSync(new URL(`../src/i18n/${code}.json`, import.meta.url), 'utf8'),
  )

  it('has no key the English source lacks', () => {
    expect(compare(source, catalogue).stale).toEqual([])
  })

  it('gives every entry the placeholders of its key and every plural the forms of its language', () => {
    const categories = new Intl.PluralRules(code).resolvedOptions().pluralCategories
    for (const [key, entry] of Object.entries(catalogue)) {
      const forms = key.split('|')
      if (typeof entry === 'string') {
        expect(forms, key).toHaveLength(1)
        expect(entry.trim(), key).not.toBe('')
        expect(placeholders(entry), key).toEqual(placeholders(key))
      } else {
        expect(forms, key).toHaveLength(2)
        expect(Object.keys(entry).length, key).toBeGreaterThan(0)
        for (const [category, text] of Object.entries(entry)) {
          expect(categories, key).toContain(category)
          expect(text.trim(), key).not.toBe('')
          expect(placeholders(text), key).toEqual(placeholders(forms[1] ?? ''))
        }
      }
    }
  })
})

/** English texts where target names a target record, whose verified German term (Target face) is Scheibe. */
const targetRecords = [
  'Target',
  'Target on the photo',
  'Add the fitted target as a scale reference of the sheet (Calibrate): its outermost marked ring at the rule-book diameter.',
  'Add the target as a scale reference',
  'All targets',
  'Centre the target on the point of aim (or the origin) at the sheet scale',
  'Choose a target',
  'Choose a target for a result.',
  'Events of the target',
  'Find target',
  'Find the target first: no black area is known.',
  'Fit target',
  "Fit the target's centre and scale to the marks",
  'Loading target',
  'Loading targets',
  'Loading the target…',
  'Mark points on two or more rings of the target, then Fit',
  'New target',
  'No target fits the rings found (dashed): choose a target, type the black diameter or set the scale.',
  'No target: no score.',
  'No targets match these filters.',
  'Printed: the first {limit} of {total} targets in this selection.',
  'Ring marks fit a target with one bull',
  'Ring value, with tenths where the target has them; X: inner ten. Excluded shots show their value and do not count in the total.',
  'Rule-book disciplines and their federations: distance, caliber classes and the targets they are shot on, each with its source.',
  'Rule-book targets: ring diameters, black area and the disciplines shot on them, each with its source.',
  'Shooting federations with the rule books their disciplines and targets are read from, each with its source.',
  'Target designer',
  'Target fitted to {count} marks, misfit {misfit}.',
  'Targets ({count})',
  'Targets need the network',
  'Targets need the network: {id} could not be loaded.',
  'Targets table',
  'Targets, {filters}',
  'Tenths in the 10 zone of this target: own rule. The 10 zone is wider than one ring and the rule book does not divide it; tenths of the ring width are counted inward from the touching edge, 10.9 for the rest of the centre.',
  'The published records, each with its source, and your own next to them: your firearms, cartridges, brass, primers, powders, bullets, targets, disciplines and federations.',
  'The rings may be those of the {face}: choose it in Target to use it.',
  "The rings of the active group's target and each shot's value, when a target is chosen (Group).",
  'The rule-book target on the photo: found from the black area and the ring lines, it sets the scale and the center and scores the group. More than one target may fit the rings: choose. Without a fit the targets are ranked by how well their rings match.',
  'The rule-book target that scores the group. Scores follow every edit; excluded shots show their value and do not count in the total.',
  'The target could not be read: {reason}',
  'The target has no ring {value}',
  'The targets and stages of this discipline',
  'The targets its disciplines are shot on',
  'The targets need the network: set the scale by hand (step 2).',
  'This target design is deleted or no longer a valid target.',
  'This target does not fit the ellipses found.',
  'must be unique within the target',
  '{count} target|{count} targets',
  '{shown} of {count} target|{shown} of {count} targets',
]

/** English texts that contain a term's English word in another sense, each with the sense. */
const otherSense: Record<string, string> = {
  ...Object.fromEntries(targetRecords.map((k) => [k, 'target: a target record, Scheibe'])),
  'Bullet position': 'where the bullet is in the barrel, not a shooting position',
  'Case fill': 'the load ratio, whose verified term (Ladedichte) names no case',
  'single shot': 'a firearm action that is loaded by hand for each shot (Einzellader)',
  'Powder temperature': 'the compound Pulvertemperatur, the usual word, in a label of one line',
  'The band is the 5th to 95th percentile of {samples} draws (seed {seed}, {failed} left the model) of the inputs, normal around their nominal values with the tolerance as the 90 % half width. The limit check uses the corner-case range {low} to {high} {unit}.':
    'corner case: an extreme combination of inputs',
  'The band is the 5th to 95th percentile of {samples} draws (seed {seed}) of the inputs, normal around their nominal values with the tolerance as the 90 % half width. The limit check uses the corner-case range {low} to {high} {unit}.':
    'corner case: an extreme combination of inputs',
  'The sampled bands are {notice}: the corner-case range is shown.':
    'corner case: an extreme combination of inputs',
  '{failed} of {total} range cases could not be computed; the true range can be wider.':
    'case: one computed combination of inputs',
  'Some cases of the pressure range could not be computed.':
    'case: one computed combination of inputs',
  '{n} of {m} range cases could not be computed ({list}); the range covers only the computed cases, and the true range can be wider.':
    'case: one computed combination of inputs',
  'Sampled bands {notice}: corner-case range shown.':
    'corner case: an extreme combination of inputs',
  Rifle:
    'a rifle as the discipline category or the firearm in a shooting-sport text, where the rule books write Gewehr; Büchse names the primer size',
  'Rifle and scope':
    'a rifle as the discipline category or the firearm in a shooting-sport text, where the rule books write Gewehr; Büchse names the primer size',
  'Empty: by cartridge class, rifle {rifle}, pistol {pistol} (assumptions, no source).':
    'a rifle as the discipline category or the firearm in a shooting-sport text, where the rule books write Gewehr; Büchse names the primer size',
  Targets: 'the Targets tab lists target records, whose verified term is Scheibe',
  'No target mapping of its disciplines names a target.':
    'target mapping: a record kind; the German names the target record, Scheibe',
  'No target mapping names this discipline.':
    'target mapping: a record kind; the German names the discipline',
  'The events and disciplines shot on this target':
    'events: the verified term of Event is Wettbewerb',
  'Shooting distance': 'the compound Schießentfernung translates both words',
  'Results are simulations, not load data. Never use a result as a charge weight or as proof that a load is safe. Start from load data published by the powder or bullet maker for your exact components.':
    'Safety text: the owner approves its wording',
  'Measurements, statistics, group sizes, scores and records shown here can contain errors from the models, the data or your inputs.':
    'Safety text: the owner approves its wording',
  'Burn rate, {unit}':
    'the heading of the burn rate figure, a single line in a narrow box where the full term does not fit',
  'Safety notice and disclaimer': 'the heading of a page that holds the notice and the disclaimer',
  'boatTailLength must be zero or more': 'zero: the number',
  'meplatDiameter must be zero up to the diameter': 'zero: the number',
  'A flat spot is a statistical observation of the strings fired: neighbouring charges whose slope of mean velocity has a {level} % band that includes zero. Few shots make wide bands. It is not a safety statement and not a charge to load.':
    'zero: the number',
  'Click both ends of a known length.': 'click: a mouse click, not a turret click',
  'Click the ring center, then a point on the ring.': 'click: a mouse click',
  'Click three points on the ring.': 'click: a mouse click',
  'Click the corners: top left, top right, bottom right, bottom left.': 'click: a mouse click',
  'Point of aim, each group its own: Set, then click it on the target, or type x and y in target coordinates; drag it with Select.':
    'click: a mouse click',
  'A drawn target. Place shots, then click where each shot hit. Or add a photo of the target: choose, drop or paste one.':
    'click: a mouse click; hit: a shot lands, not a scored Treffer',
  'A drawn target. Place shots, then click where each shot hit. Or add a photo of the target.':
    'click: a mouse click; hit: a shot lands',
  'Place shots, then click each hole.': 'click: a mouse click',
  'Click the photo point of target (0, 0). {keys}': 'click: a mouse click',
  'Click the point of aim of the active group. {keys}': 'click: a mouse click',
  'Click a hole to add a shot to the active group.': 'click: a mouse click',
  'Shot: add shots to the active group by click or tap': 'click: a mouse click',
  Clicks:
    "turret clicks, the unit of an adjustment (the German word is the one of the term row's turret sense)",
  'Optic for clicks': 'turret clicks',
  'Clicks of {optic} ({mrad} mrad, {moa} MOA) that move the group center onto the point of aim.':
    'turret clicks',
  'Choose, drop or paste a photo; it stays in this browser and is never uploaded.':
    'drop: drop a file onto the page, not a bullet drop',
  'Photo: choose, drop or paste one; it stays in this browser and is never uploaded':
    'drop: drop a file onto the page',
  'Click or tap the graduation of the ruler at two points, A and B, then enter their distance. Drag a point to move it. A second pair, C and D, checks the first.':
    'drag: move with the pointer, not air drag',
  'Include shot positions': 'where the shots are on the sheet, not a shooting position',
  'Select: drag shots, points of aim and reference points; drag the background to pan':
    'drag: move with the pointer, not air drag',
  'The federation whose disciplines the Discipline list shows. All: every discipline, then the target events no discipline names.':
    'events: the verified term of Event is Wettbewerb, a rejected candidate of Discipline',
  'The discipline sets the target, the event and with it the scored hole. Type to search by name, number or federation.':
    'events: the verified term of Event is Wettbewerb, a rejected candidate of Discipline',
  "A target no discipline names: the event's gauge is the scored hole, as the rule book says; a black-powder event scores the hole centre. Bullet: the bullet diameter of the load, else Marker.":
    'events: the verified term of Event is Wettbewerb, a rejected candidate of Discipline',
  'No hole size: set Marker, or choose a discipline or event with a gauge.':
    'events: the verified term of Event is Wettbewerb, a rejected candidate of Discipline',
  'Where a further shot lands with the stated coverage (50 %, 95 %), from the shots of the group. Absent below 3 shots.':
    'lands: a shot lands, not the rifling lands',
  'Load a photo first.': 'load as the verb for a photo file, not a load (Laborierung)',
  'More than one target fits these rings: choose one in Target.':
    'the target is the record to choose in the field Target, whose German label is Scheibe',
  'Diameter of the black area on the target, used when no target fits: it sets the scale and the center from the black area alone (the center is approximate on a tilted photo).':
    'a target record that fits is a Scheibe, the paper target stays Zielscheibe',
  'Proposals are dashed on the photo; none counts until accepted. On the photo: double-click or Enter accepts one, drag or arrow keys move it, Delete removes it.':
    'drag is the mouse action, not aerodynamic drag',
  '{label}. Double-click or Enter accepts it, drag or arrow keys move it, Delete removes it.':
    'drag is the mouse action, not aerodynamic drag',
  'Drop a file here or click to choose': 'drop means dragging a file onto the area',
  'Drop files here or click to choose. Read in this browser, not uploaded.':
    'drop means dragging files onto the area',
  'Drop a file here or click to choose. Read in this browser, not uploaded.':
    'drop means dragging a file onto the area',
  'Choose or drop a chronograph file, or load the example: three strings of ten made-up shots.':
    'drop means dragging a file onto the page; load means to open the example, not a cartridge load',
  'Load example': 'load means to open the example, not a cartridge load',
  'Muzzle distance: {distance}':
    'distance of the chronograph from the muzzle (table term Entfernung is used)',
  'Statistics per string, excluded shots left out ({unit})': 'left out, not a drop',
  'Cold bore': 'cold bore shot, term Kaltschuss',
  'Read {strings}, {shots}.':
    'the shot count is the {shots} placeholder (filled with the plural text)',
  'Velocity unit when the file names none': 'names is a verb (the file states none)',
  'Enter the velocity as a number above zero.': 'zero is the number',
  'Name the bullet the lands contact was measured with': 'Name is a verb',
  'must be above absolute zero': 'absolute zero is the temperature, not zeroing a rifle',
}

const wordPattern = (word: string) => new RegExp(`\\b${word}(e?s)?\\b`, 'i')
const termWords = (english: string) => english.replace(/\s*\(.*\)/, '').split(', ')
const phrases = terms.terms
  .filter((t) => t.status !== 'unverified')
  .flatMap((t) => termWords(t.english))

/** Whether the English word occurs in the key outside the longer terms of the table that contain it ('Target face' owns 'target'). */
function occurs(word: string, key: string): boolean {
  const rest = phrases
    .filter((p) => p.length > word.length && wordPattern(word).test(p))
    .reduce((k, p) => k.replace(new RegExp(wordPattern(p).source, 'gi'), ' '), key)
  return wordPattern(word).test(rest)
}

const textOf = (entry: string | Record<string, string>) =>
  typeof entry === 'string' ? entry : Object.values(entry).join(' ')

describe('German catalogue', () => {
  it('writes a verified term of the table as the table does, where its English word occurs', () => {
    // a verified row whose English is one word or comma separated single words ('Case, brass'); the
    // English words and the German words of a row pair up by position when both lists are as long
    const words = terms.terms
      .filter((t) => t.status === 'verified' && t.german)
      .filter((t) => t.english.split(', ').every((w) => /^[A-Za-z]+$/.test(w)))
      .flatMap((t) => {
        // 'Pistol, revolver, handgun' is 'Pistole, Revolver, Kurzwaffe': each word has its own
        // German word when the lists are as long as each other, else the whole German text
        const english = t.english.split(', ')
        const german = (t.german ?? '').split(', ')
        return english.map((word, i) => ({
          word,
          german: (german.length === english.length ? german[i] : t.german) ?? '',
        }))
      })
    for (const [key, entry] of Object.entries(de)) {
      if (key in otherSense) continue
      for (const w of words.filter((w) => occurs(w.word, key)))
        expect(fold(textOf(entry)), `${key}: ${w.german}`).toContain(fold(w.german))
    }
  })

  it('writes a decided multi word term as the table does, where its English phrase occurs', () => {
    const decided = terms.terms.filter(
      (t) => t.status === 'decided' && t.german && /^[A-Za-z]+( [A-Za-z]+)+$/.test(t.english),
    )
    for (const [key, entry] of Object.entries(de)) {
      if (key in otherSense) continue
      for (const t of decided.filter((t) => wordPattern(t.english).test(key)))
        expect(fold(textOf(entry)), `${key}: ${t.german}`).toContain(fold(t.german ?? ''))
    }
  })

  it('does not write a rejected candidate of a decided term where its English word occurs', () => {
    for (const t of terms.terms.filter((r) => r.status === 'decided')) {
      const rejected = t.candidates.map((c) => c.german).filter((g) => g !== t.german)
      const asWord = rejected.map((r) => new RegExp(`(^|[^a-z])${fold(r)}(n|s|e|es|en)?($|[^a-z])`))
      for (const [key, entry] of Object.entries(de)) {
        if (key in otherSense || !termWords(t.english).some((w) => occurs(w, key))) continue
        for (const [i, pattern] of asWord.entries())
          expect(fold(textOf(entry)), `${key}: ${rejected[i]} for ${t.german}`).not.toMatch(pattern)
      }
    }
  })

  it('lists only texts that are in the English source', () => {
    expect(Object.keys(otherSense).filter((k) => !source.includes(k))).toEqual([])
  })
})
