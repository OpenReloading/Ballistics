# Shape of a published load row

Ticket: OpenReloading/Ballistics#819, part of the wayfinder map #817. Blocks #826 (import), #827 (workbench deviation view) and #829 (missing sources). Neighbouring tickets that refine single fields: #818 (file layout and size), #820 (maker or customer data), #821 (bullets and powders without dimensions), #823 (comparable deviation), #824 (primer).

## Answer

- New kind, not `Load`, not `FiringSeries`: one file holds the printed loads of one table for one cartridge (`publishedLoads`). A load is the printed recipe once (bullet, powder, primer, case, COAL, barrel) with a list of `charges`. Each charge (start, max, single, recommended) carries its own velocity and pressure, because tables print them per charge, not per load.
- Every printed figure is `{ value?, raw }`. `raw` is always present and is the printed token with its unit. `value` is the stored-unit number, converted with the exact factor and kept to 7 significant digits. It is absent where the table prints a figure that has no stored unit (CUP and LUP pressures, `Flush`).
- Pressure has `unit` as printed (`bar`, `psi`, `CUP`, `LUP`), a `method` only where the source names one or the unit implies it, and `methodBasis` saying which. The method of 2,955 rows (Reload Swiss, Lovex) stays absent.
- Provenance reuses `provenance` and the source records. The paste fields `source_manufacturer` and `source_url` become `publisher` and `url` of the table's source record. Each load adds its own `page` and, where it has one, a deep-link `url`. `retrieved` and `edition` come from the source record. The maker-or-customer flag is the existing `origin` of the source.
- The hold-out split is not stored. It follows from `cartridge`: first byte of SHA-256 of the lower-case cartridge id, 0 to 50 test, 51 to 101 validation, 102 to 255 training. The rule reproduces the split column of all 68,502 collected rows (0 mismatches). A file without `cartridge` has no split and no fit reads it.

Open points for the owner are at the end (licence, Norma charge unit, Lovex URL, wording of `origin`).

## What the tables print

Basis: the collected maker load tables, 10 tables of 9 makers (Hodgdon with IMR, Winchester, Accurate and Ramshot in one manual; Western; Alliant; Vihtavuori; Norma; RWS; Reload Swiss; Vectan; ADI; Lovex), 68,502 printed charges, collected 2026-10-12 and 2026-10-13. Counts below are from those rows.

| Fact | Count | Consequence for the shape |
| --- | ---: | --- |
| Printed charges | 68,502 | one `charges` entry each |
| Loads (same page, cartridge, bullet text and mass, powder, COAL, barrel, primer and case text) | 35,639 | 32,676 start+max pairs, 2,428 max only, 393 recommended only, 48 single, 28 start only, about 66 irregular (repeated start or max under one header, resolved by order on the page) |
| Charge kinds | start, max, single (Western), recommended (Hodgdon subsonic and reduced-recoil tables) | `kind` enum of 4 |
| Velocity printed | 68,051 | per charge; RWS prints none for its 451 minimum charges |
| Velocity measuring point printed | 4,171 (Reload Swiss 2,190 as V5, Lovex 1,530 as V5, RWS 451 as v3) | `point.label` as printed; `distance` only where the source defines the symbol; never defaulted |
| Pressure with a bar or psi figure | 29,147 | `value` in bar |
| Pressure as CUP (copper crusher), no bar value | 10,823 | `value` absent, `unit: CUP`, `raw` kept; no conversion to bar |
| Pressure method named by the source | Hodgdon 19,447 (PSI by transducer, CUP by crusher), Western 6,117 | `methodBasis: stated` |
| Pressure method read from the unit only | ADI 5,510 psi rows (assumed transducer) and 5,942 CUP rows (the unit names the crusher) | `methodBasis: from-unit` |
| Pressure, no method | Reload Swiss 2,190, Lovex 765 (printed next to the C.I.P. maximum, method not described) | `method` absent |
| Pressure printed | 39,970 of 68,502 | Western and Lovex print it for the max charge only, so it sits on the charge |
| COAL printed | 66,371 | Vectan prints none; Alliant prints a minimum (2,056 rows) so `limit: min`; `Flush` has no number |
| Barrel length printed | 62,022 | RWS gets it from another table of the same publisher (896 rows) |
| Twist printed with the barrel | Hodgdon, Western, Reload Swiss, Vihtavuori | `barrel.twist` |
| Primer printed | 38,855 (ADI, Alliant, Hodgdon, Reload Swiss, RWS, Vectan; Vectan prints the size only) | free text as printed; #824 decides the rest |
| Case printed | ADI, Alliant, Hodgdon, Reload Swiss, RWS | free text as printed |
| Marks printed with a meaning | compressed 5,680, subsonic 90, reduced recoil 35, do not reduce 19 | `marks` enum |
| Marks printed without a meaning | `F` 117, `A` 16, `*` 8 | `printedMarks`, as printed |
| Units printed per table | g and gr, g/gr pairs (Lovex, RWS, Vectan, Norma bullet), fps, m/s, psi, bar, CUP, in, mm | `raw` keeps the pair as printed |
| Charge with no printed unit | Norma 2,394 | `assumedUnit` |

Things collected next to the rows that are not printed facts and stay out of the records: "same values as another powder in this file" (thousands of rows), "also in a newer edition" (4,155), parse remarks, and the bullet length (no table prints one).

## Reuse: `Load`, `FiringSeries`, `load-tables.json`

- `Load` (`packages/schema/src/load.ts:297`, fields in `loadShape`) is one recipe with a single required `charge` for a catalogue load (`checkCatalogueFields`, `load.ts:251`-`262`), no velocity, no pressure, no barrel and no start/max pair. Its description branch (`bulletDescription`, `powderDescription`, `load.ts:124`-`135`) needs a manufacturer reference, which the printed text ("HDY XTP", "Nosler Accubond") does not give, and is allowed only for provenance `measured` (`checkRecordReferences`, `load.ts:274`-`286`). Printed tables are `published`. Adding outputs and ranges to `Load` would put optional fields on every user load. Decision: keep `Load` as the workbench recipe and add a pure mapping from one charge of a published load to a `Load` (cartridge, bullet, powder, `charge`, seating by overall length from COAL) for the workbench (#827). Barrel length and twist have no `Load` field today (the firearm is a reference), so that mapping is #827's to settle.
- `FiringSeries` (`packages/schema/src/firing.ts:13`-`56`) is a measured series of rounds of one ammunition: provenance must be `measured` and every source needs a URL and a licence (`firing.ts:50`-`53`), the ammunition is one free-text string, pressure needs a gauge position. A maker table is a recommended recipe with a printed velocity, not a series, and has no licence to name (see the owner points). Not reused. The one thing taken from it is the practice of printing `point` as the source words it.
- `load-tables.json` (`packages/schema/src/load-tables.ts:10`-`25`, read by `readLoadTables`, `packages/data/src/records.ts:87`) lists the tables a powder fit read: manufacturer, title, URL, retrieval date, keyed by row file. The gate `checkFittedSources` matches a fitted powder source to it by title, URL and retrieval date (`packages/data/src/load-tables.ts:6`-`9`). Decision: no change in this ticket. Each table becomes one source record in `records/sources` (`sourceRecord`, `provenance.ts:120`) with the same title, URL and retrieval date, so the gate keeps matching after the source reference is resolved. Whether the `load-tables.json` key becomes the source record id, or the file is generated from the source records, is for the refit ticket (#828).
- Reused as they are: `provenance`, `source`, `sourceRecord` and the reference resolution (`packages/data/src/sources.ts:58`-`), `pressureMethod` (`packages/schema/src/standards.ts:5`), `catalogueRef` (`packages/schema/src/ids.ts`), the stored units (`packages/schema/src/units.ts:4`-`57`).
- Not reused: `quantity()` (`units.ts:120`-`131`) has `raw` optional, "when it differed". For printed data `raw` is required, so a local `printedValue` wraps the same `value` and `raw` fields with `raw` required. Whether `quantity` itself gets a required-`raw` variant is a schema decision for the implementation.

## Draft shape

Draft only, not in `packages/`. It parses six invented rows that follow the hard cases of the tables (CUP and psi in one load, no unit printed, minimum without velocity and a velocity point with distance, single load with a method read from the unit, minimum OAL with `Flush`, a JSON position as URL fragment and no cartridge record) and rejects seven wrong ones (bar value on a CUP figure, psi without value, method without basis, `single` next to `max`, value without `raw`, source without URL, provenance `measured`). It was run with zod 4.6.7 in the dev container.

```ts
import { z } from 'zod'
import { catalogueRef, recordId } from './ids.ts'
import { provenance } from './provenance.ts'
import { pressureMethod } from './standards.ts'
import { type QuantityKind, units } from './units.ts'

/**
 * A value as the table prints it: `raw` is the printed token with its unit (`55 gr`, `13,600 PSI`,
 * `3,30 g / 50 grs`), glyph spacing collapsed, always present. `value` is the printed number in the
 * stored unit of `kind`, converted with the exact factor and kept to 7 significant digits.
 */
const printedValue = (kind: QuantityKind, value: z.ZodNumber = z.number()) =>
  z.strictObject({
    value: value.describe(`In ${units[kind]}.`),
    raw: z.string().min(1).describe('The printed value with its unit, as printed.'),
    assumedUnit: z
      .string()
      .min(1)
      .describe('Unit the value was read in where the source prints none; `value` rests on it.')
      .optional(),
  })

/** Like {@link printedValue}, for a printed figure that has no value in the stored unit (`Flush`, CUP). */
const printedText = (kind: QuantityKind, value: z.ZodNumber = z.number()) =>
  printedValue(kind, value).partial({ value: true })

const mark = z.enum(['compressed', 'do-not-reduce', 'subsonic', 'reduced-recoil'])

/** Peak pressure of one charge. A crusher figure (CUP, LUP) is not converted to bar. */
const pressure = z
  .strictObject({
    unit: z.enum(['bar', 'psi', 'CUP', 'LUP']).describe('Unit the table prints.'),
    peak: printedText('pressure', z.number().positive()),
    method: pressureMethod.describe('Measuring method.').optional(),
    methodBasis: z
      .enum(['stated', 'from-unit'])
      .describe('`stated`: the source names the method. `from-unit`: read from the unit.')
      .optional(),
  })
  .superRefine((p, ctx) => {
    const converts = p.unit === 'bar' || p.unit === 'psi'
    const issue = (path: string[], message: string) =>
      ctx.addIssue({ code: 'custom', path, message })
    if (converts !== (p.peak.value !== undefined))
      issue(['peak', 'value'], 'a value in bar for bar and psi, none for CUP and LUP')
    if ((p.method === undefined) !== (p.methodBasis === undefined))
      issue(['methodBasis'], 'a method and its basis go together')
    if (p.method === 'crusher' && converts) issue(['method'], 'a crusher method prints CUP or LUP')
  })

const velocity = z.strictObject({
  ...printedValue('velocity', z.number().positive()).shape,
  point: z
    .strictObject({
      label: z.string().min(1).describe('The symbol the table prints (`v3`, `V5`, `V0`).'),
      distance: printedValue('length', z.number().nonnegative())
        .describe('Muzzle to the measuring point, where the source defines the symbol.')
        .optional(),
    })
    .describe('Where the velocity applies. Absent where the table says nothing.')
    .optional(),
})

/** One printed charge of a load with the velocity and pressure printed for it. */
export const publishedCharge = z.strictObject({
  kind: z
    .enum(['start', 'max', 'single', 'recommended'])
    .describe('The lower and the upper figure of a table, a single load, a load of a reduced table.'),
  charge: printedValue('mass', z.number().positive()),
  velocity: velocity.optional(),
  pressure: pressure.optional(),
  marks: z.array(mark).min(1).describe('Marks the table states a meaning for.').optional(),
  printedMarks: z
    .array(z.string().min(1))
    .min(1)
    .describe('Marks printed without a stated meaning (`F`, `A`, `*`), as printed.')
    .optional(),
})

/** One load of a table: the recipe printed once, with its start and maximum charge. */
export const publishedLoad = z
  .strictObject({
    bullet: z.strictObject({
      printed: z.string().min(1).describe('Bullet text as printed: make, type, number.'),
      mass: printedValue('mass', z.number().positive()),
      record: catalogueRef('bullet').optional(),
    }),
    powder: z.strictObject({
      printed: z.string().min(1).describe('Powder name as printed.'),
      record: catalogueRef('powder').optional(),
    }),
    primer: z.string().min(1).describe('Primer as printed, with its size.').optional(),
    case: z.string().min(1).describe('Case as printed.').optional(),
    coal: printedText('length', z.number().positive())
      .extend({ limit: z.enum(['min', 'max']).describe('Printed as a limit.').optional() })
      .optional(),
    barrel: z
      .strictObject({
        length: printedValue('length', z.number().positive()).optional(),
        twist: printedValue('length', z.number().positive())
          .describe('Length of one turn: `1:12"` is 304.8 mm.')
          .optional(),
      })
      .optional(),
    charges: z.array(publishedCharge).min(1).max(4),
    page: z.string().min(1).describe('Page, anchor or row of the source as printed or linked.'),
    url: z
      .url({ protocol: /^https?$/ })
      .describe('Deep link to the page or row, where it differs from the source URL.')
      .optional(),
  })
  .superRefine((l, ctx) => {
    const kinds = l.charges.map((c) => c.kind)
    const issue = (message: string) => ctx.addIssue({ code: 'custom', path: ['charges'], message })
    if (new Set(kinds).size !== kinds.length) issue('one charge of each kind')
    if (kinds.includes('single') && kinds.length > 1) issue('a single load stands alone')
  })

/** The load rows of one table for one cartridge: one file of the catalogue. */
export const publishedLoads = z.strictObject({
  id: recordId,
  maker: recordId.describe('Manufacturer record that publishes the table.'),
  cartridgeName: z.string().min(1).describe('The cartridge as the table prints it.'),
  cartridge: catalogueRef('cartridge')
    .describe('Set where a record matches the printed name. Without it the rows have no hold-out split.')
    .optional(),
  loads: z.array(publishedLoad).min(1),
  provenance: provenance.refine(
    (p) =>
      p.kind === 'published' &&
      p.sources.every((s) => s.publisher && s.url && s.retrieved && s.origin),
    { message: 'published, and each source names publisher, URL, retrieval date and origin' },
  ),
})

/** A row, its charges and the file it is in. */
export interface PublishedLoad extends z.infer<typeof publishedLoad> {}
/** One file of load rows. */
export interface PublishedLoads extends z.infer<typeof publishedLoads> {}
```

The JSON Schema it generates (`z.toJSONSchema(publishedLoads, { io: 'input' })`, the call `write-json-schema.ts` uses) is in `research/load-row-shape.schema.json` next to this file. Refinements (the pressure rules, one charge per kind, the provenance rule) are not part of a JSON Schema, as with the other records.

### Field notes

- Record: `id` is `<table>-<cartridge>`, with the printed cartridge name slugged where no cartridge record exists. `maker` is the manufacturer record that publishes the table, as `loadTable.manufacturer` does today. The file packing (one file per table and cartridge: 1,039 files for the collected tables, median 30 charges, 90th percentile 157, maximum 1,296) is a working assumption, not a decision of this ticket; #818 measures it. The load and charge shape does not depend on it. Rows have no id of their own: a row is `<file id>` plus its position, which shifts on re-import, so a stable row key is a question for #818 and #827.
- `bullet.printed` keeps make, type and number as one printed string. Splitting the make from the model is a matching step (the map lists bullet naming across makers as not yet specified); it sets `bullet.record` and nothing else. `bullet.mass` is the printed mass of the load, whatever mass the matched record has.
- `powder.printed` is the printed name. The powder maker is not a field because most tables do not print it next to the name; a record match sets `powder.record`.
- `primer` and `case` are the printed text. The first is refined by #824.
- `coal` is the printed overall length. `limit: min` for Alliant, whose tables print a minimum OAL.
- `barrel.twist` is the length of one turn in mm, so `1:12"` is 304.8 mm with `raw` `1:12"`, as `Bullet.recommendedTwist` stores twist (`bullet.ts:324`).
- RWS prints its test barrels in a different document of the same publisher. That is a second entry in `provenance.sources` with `fields` listing the barrel path, which the source schema already supports (`provenance.ts:59`-`64`), not a new field.
- `kind: recommended` and the marks `subsonic` and `reduced-recoil` carry what the Hodgdon subsonic and reduced-recoil tables print; the load is still the printed recipe.
- Customer data: the table's source states `origin`. `manufacturer` is the maker's own table; the value for customer data is #820's.

### Units, `raw` and precision

- Stored units follow `units.ts`: g, mm, m/s, bar. The 1 gr = 0.06479891 g, 1 in = 25.4 mm, 1 ft/s = 0.3048 m/s are exact by definition; 1 psi = 0.0689475729316836 bar (from 0.45359237 kg, 9.80665 m/s2 and 0.0254 m).
- `raw` is the value's own token with its unit, as printed (`55 gr`, `13,600 PSI`, `3,30 g / 50 grs`), with the glyph spacing of a PDF text layer collapsed (Western prints `Tw ist: 1 - 1 2 "`). It is not the whole header line: Hodgdon and Western print barrel, twist, trim length and primer in one line, which becomes separate fields.
- `value` is the printed number times the exact factor, to 7 significant digits: 13,600 psi is 937.687 bar, 55 gr is 3.563940 g. The collected rows round more coarsely (938 bar, 3.5639 g); the records must not inherit that. A data check converts `value` back to the printed unit and compares it to the number in `raw`.
- An unprinted unit is not hidden: Norma prints charges as bare numbers (`Max 32.7`). The values are on the grain scale next to the printed bullet weights in grains, so `value` is read in grains and each such charge says `assumedUnit: gr`.
- No row is interpolated, rounded to a nicer value or filled from another table. A figure the table does not print is absent: no velocity on RWS minimum charges, no pressure on Vihtavuori, no barrel on Alliant.

### Provenance mapping

| Paste field | Where it goes |
| --- | --- |
| `source_manufacturer` | `publisher` of the table's source record, and `maker` (manufacturer record id) of the file |
| `source_url` | `url` of the source record (the PDF or page), and `url` of a load where it deep-links (`...AM25.pdf#page=76`, `...json#Relodata[3368]`) |
| retrieval date | `retrieved` of the source record |
| edition | `edition` of the source record |
| page | `page` of the load, as printed or linked |
| SHA-256 of the download | `sha256` of the source record (the download itself stays out of the repository) |
| maker's own terms | `terms` of the source record, where it states any; `license` as the owner decides below |
| maker data or customer data | `origin` of the source |

The effective URL of a load is its `url`, else the source's. The flat JSON array of the paste (one object per printed load with `source_manufacturer` and `source_url`) is an export computed from the records, not a second stored form.

Cited code: `source` fields `publisher`, `edition`, `url`, `retrieved`, `sha256`, `license`, `terms`, `origin` at `packages/schema/src/provenance.ts:37`-`115`; records name a source record by id and the reader merges it (`packages/data/src/sources.ts`). Only the record's own `provenance` is resolved, so a per-load citation by source id would need a change to the resolver. Hence `page` and `url` on the load instead.

### Rows that do not fit a record cleanly

- 2,615 rows have no cartridge record at all (wildcats and names no record carries), so their file has `cartridgeName` only. They are published, shown as "not in the catalogue", and have no split, so no fit reads them.
- 3,054 rows (16 cartridge ids) match a cartridge the collected records know but the public cartridge records of this repository do not (577 records, 257 distinct ids in the tables). They keep `cartridge` once the record is published, which moves them into a split; until then they are treated like the 2,615.
- Lovex: two pages have two overlaid text layers. The 24 rows (12 loads) of page 37 do not parse and were transcribed by hand from the rendered page; the 50 rows of page 9 parse and were compared with the rendered page. This belongs in the import report, not in the records.
- Hodgdon: malformed printed pressures (for example a figure with a stray digit group) keep `raw` and no `value`.
- 1 LUP figure: `unit: LUP`, no `value`.

## Open points

1. Licence of the rows (owner decision). Three positions are on the table. (a) The data package default: a source without `license` is under CC BY 4.0 (`provenance.ts:70`-`75`, `packages/data/LICENSE`). (b) The map's note: no project licence on maker data, the maker as `publisher`, the maker's terms in `terms`, expressed as `license: LicenseRef-<name>` (the SPDX form for terms not on its list, `LicenseRef-` followed by letters, digits, `.` and `-`, https://spdx.github.io/spdx-spec/v2.3.1/other-licensing-information-detected/). (c) The CC0 1.0 dedication named in the data-extraction brief. The draft does not require `license` and does not choose; it uses no licence value in the types. Whether facts in a table are protected is a legal question this note did not research (unverified).
2. `origin: manufacturer` is documented as "used with its permission" (`provenance.ts:11`-`14`). A maker table collected from a public page is not that. Recommendation: reword to "data it supplied or published" and keep any permission in `terms`. The draft requires `origin`.
3. Norma's 2,394 charges have no printed unit. Recommendation: keep `value` with `assumedUnit: gr`. Alternative: `raw` only, which removes Norma from every fit and every deviation view.
4. The Lovex guide was obtained as a copy from a distributor site, not from the maker's own site (1,530 rows, 765 loads), so there is no confirmed official URL. Recommendation: publish it with the distributor URL as printed in the source record and a `note` saying so, or hold the table back until the maker's URL is confirmed.
5. Where a table prints a pressure but names no method (Reload Swiss, Lovex) the data stays method-free, and a fit decides how to treat it (#823). The ADI psi figures carry `from-unit` for the same reason.
6. A stable key for a single printed load (needed to cite a row in the deviation view and the validation report) depends on the packing chosen in #818.

## Not checked

- The statements about what each maker's table says about pressure method and velocity point come from the collection notes of the tables as read on 2026-10-12 and 2026-10-13; the PDF pages were not re-read for this ticket (unverified here).
- The meaning of `v3` (RWS) and `V5` (Reload Swiss, Lovex) as a distance from the muzzle is not confirmed from the makers; `distance` stays absent until #823 reads their definitions.
- No file was added to `packages/`, no JSON Schema export was changed, and no import was run. The generated JSON Schema file is from the draft only.
