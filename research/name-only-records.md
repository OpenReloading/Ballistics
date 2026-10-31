# Name-only bullets and powders: what is missing today and what the schema and the workbench do with them

Research note for ticket #821 of the wayfinder map #817. Counts are from the 68,502 rows of the collected maker load tables (10 makers) and the existing real records of 1,684 bullets, 247 powders and 26 manufacturers, which #825 publishes. Code claims carry file and line of `origin/main` at 1538394. No external source was needed: every claim is about this repository or these rows.

## Result

- Powders need no schema change. A powder record requires only `id`, `manufacturer`, `name` and `provenance` (`packages/schema/src/powder.ts:125-155`), and 5 of the 247 existing powder records are already name only. Two printed powder names have no record (20 rows).
- Bullets need two optional fields and one marker. `productNumber` and `diameter` become optional, and a new literal `nameOnly: true` says why they are absent. Without it a record that lacks either fails `data:validate`, so a full record cannot lose them by mistake.
- Diameter is stored only where the table prints it, as printed. It is never taken from the cartridge: the cartridge value is a maximum, and the diameter is not part of the interior run.
- At least about 2,700 of about 3,700 distinct (maker, type, mass) bullets and about 61 % of the rows have no bullet record today. 21 bullet makers have no manufacturer record. 967 bullets (8,142 rows) print no maker and fit no record shape.
- The workbench runs the interior simulation of a name-only bullet at once, because it reads only the bullet mass. The trajectory asks for the missing diameter and BC in place.

## 1. Counts

"No record today" is counted against the existing real records. On `main` the catalogue holds only demo records (2 bullets, 1 powder, 4 manufacturers in `packages/data/records`), so there every row lacks a record until #825 lands.

### Powders

| Measure | Count |
|---|---|
| Distinct powder names as printed, per maker | 283 |
| Resolved to an existing powder record | 246 of 246 distinct ids, all files exist |
| Printed names with no record | 4 names, 50 rows |
| Of these, real powder names | Alliant `Varmint` (14 rows), Vectan `T8000` (6 rows) |
| Of these, reading artifacts, no powder | Norma `-` (28 rows), Norma `Norma Brass 300 Blaser Mag.` (2 rows) |
| Existing powder records with no data field beyond name and provenance | 5 of 247 |
| Existing powder records without `interior` (no fitted model) | 24 of 247 |

Whether `Varmint` or `T8000` is an existing powder (a product of the same maker under another name) is not stated by the tables. The two names stay separate records until a maker statement settles it. A later merge is a `renames.json` entry of kind `powders` (`packages/schema/src/renames.ts:5-17`). `aliases` is for names a maker states (`powder.ts:131`), so it is not used for a guess.

### Bullets

Rows name a bullet by one free text, with the maker abbreviated or absent and sometimes with the product number, calibre or mass inside it (`HDY V-MAX`, `Hornady V-Max`, `SIERRA HPBTMK`, `Nosler BST 140 gr 270 Caliber`, `GR RN Hornady No. 3090`, `HP`). The key (maker, type, mass) was built by a plain normaliser: known maker spellings and abbreviations mapped to one maker, case and punctuation removed, trailing mass and calibre text and item numbers dropped, mass rounded to whole grains. It does not merge real spelling variants (`B-TIP` and `Ballistic Tip`, `HPBTMK` and `HPBT MatchKing`), so every distinct-bullet count below is an upper bound.

| Measure | Count |
|---|---|
| Distinct (printed type text, mass) | 4,750 |
| Distinct (maker, normalised type, grains) | 3,684 (upper bound) |
| Of these with a maker named | 2,717 |
| Of these with no maker printed | 967 keys, 8,142 rows (11.9 %), for example `HP`, `FMJ`, `CAST LRNFP`, `(L) LC SWC`, `BME PUNCH` |
| Keys by maker, largest | Hornady 444, Sierra 417, Speer 315, Barnes 294, Nosler 245, Berger 196, Lapua 108, Norma 91, RWS 85 |
| Keys whose cartridges differ in bullet diameter G1 by more than 0.3 mm | 235 (6.4 %); split by calibre the count is about 3,930 |
| Keys that may match an existing record (a record of the same maker within 1 gr of the mass) | at most 961 keys, 26,986 rows (39 %) |
| Keys with no possible record | at least 2,723 keys, at least 41,516 rows (61 %) |

The 961 compare maker and mass only. A record's name is the maker's product wording (`20 CAL 32 GR Tipped VarmintKing (TVK)`), no record has the table's type word (`HPBT`, `SP`) as a field, and the rows carry no product number. So not one row can reference a bullet record by any key that exists, and a "match" needs a mapping that nobody has built (#826, #829). The ceiling is useful for sizing only.

Spot check of 20 keys drawn at random (seed 821): in the 14 with a maker assigned, none was assigned wrongly. The 6 without a maker were abbreviations of a maker or generic types (`FA FP`, `BME PUNCH`, `WM FP Silver Moly`, `CPB LWFNGC`, `JSP-FN`, `LFN`), so some of the 967 are bullets of a known maker whose abbreviation the normaliser does not read. Assigning those makers from the product line would be an estimate, which the map forbids, so they stay unassigned.

Manufacturers: the existing real records hold bullet records of 11 makers (Cutting Edge, Hammer, Hornady, Lehigh, Missouri Bullet, Sako, Sierra, Sellier and Bellot, Berger 2, Lapua 1, Nosler 1). Manufacturer records exist for 13 of the 34 makers the normaliser found, among them Sierra, Hornady, Nosler, Berger, Lapua, Norma and RWS. The other 21 have none (Speer 315 keys, Barnes 294, Swift 67, Federal 52, Berry's 50, H&N 42, Remington 31, Woodleigh 30, and 13 more with 25 keys or fewer, 1,023 keys together; the smallest mappings, such as `LOS`, `MSS` and `VPR`, are guesses of the normaliser). A manufacturer record needs only `id`, `name` and `provenance` (`packages/schema/src/manufacturer.ts:15-26`), so these are cheap to add.

### What the tables print about the bullet

- Mass: every row, in grains or grams as printed.
- Diameter or calibre: Western prints `Bullet Diameter` in the header of every table (12,215 of its 12,251 rows, 17.8 % of all rows). Norma prints a calibre label in the type text on about 1,960 of 2,394 rows (`5.7mm Caliber`, `7mm (.284)`), Reload Swiss and Vectan on 12 rows. The collected rows keep the Western diameter only inside a raw header text, not in a column of its own, so #819 should give it a field.
- Length: none. BC: a few Norma rows in a note (`BC 0.267`). Product number: some Lapua types (`N560`) and Sellier and Bellot item numbers, as part of the type text.

## 2. Schema: which bullet fields become optional

`packages/schema/src/bullet.ts:297-329` requires `productNumber` (line 303) and `diameter` (line 309). Everything else is optional already, and in the existing real records 515 of 1,684 lack a BC, 435 lack a length and 23 lack a `caliber`, so absent values are normal.

Recommendation:

- `productNumber` and `diameter` optional.
- `nameOnly: z.literal(true).optional()`, the pattern of `unmapped` (`bullet.ts:102`).
- `superRefine`: without `nameOnly`, `productNumber` and `diameter` are required (message "a full record needs a product number and a diameter"). With `nameOnly`, `productNumber` must be absent, and `diameter` may be present (Western and Norma print it).
- `mass` stays required: every table prints it, and it is the one bullet value the interior run needs (`apps/web/src/lib/interior-input.ts:46`).
- `manufacturer` stays required (see open point 2).

The rule that keeps a full record whole is this refinement, a mechanical check in `data:validate` through `readKind` (`packages/data/src/read-kind.ts`), not a convention. Deleting `diameter` from a full record fails the parse. To make a record name only, an author must also set `nameOnly` and drop `productNumber`, which is a visible change in the diff and in the id (section 4). The generated bullet records carry the line "Generated by tools/src/import-bullets.ts from the maker's document; do not edit by hand", so the same tool must refuse to write a name-only record over a file that holds a full record.

Alternatives weighed:

- A separate record kind or directory for name-only bullets: touches the API index, search, references, renames kinds and the load references, and a later promotion moves a record between kinds. Rejected.
- A `complete` flag set by hand: unchecked, so it can disagree with the fields. The literal marker above is checked in both directions.
- An optional `diameter` without a marker: a full record could then lose it silently, which the ticket asks to prevent.

Also needed in the same change (`packages/data`): `coverage.ts:4-15` lists the identity fields that need no source; `nameOnly` goes there. `plausibility.ts:131-146` and `:182-191` read `bullet.diameter.value` and skip their diameter checks without one. User variants need nothing new: `bulletOverrides` is a partial of the entity (`packages/schema/src/overrides.ts:198`), and `userBullets` already treats mass, diameter and length of the resolved record as possibly absent (`apps/web/src/lib/variants.ts:178-217`). A variant of a name-only bullet that sets a diameter should remove the marker (`nameOnly: null` removes a field of the base).

## 3. Diameter from the cartridge

Recommendation: leave `diameter` empty unless the table prints it; do not derive it from the cartridge.

- The cartridge value is G1, the maximum projectile diameter of the C.I.P. sheet (`packages/data/src/caliber-classes.ts:7-12`), not the bullet's diameter. The 308 Winchester sheet has G1 7.85 mm; the bullet records have 7.823 mm. Storing G1 as `diameter` would be an estimate of a value no source prints, which the map's notes rule out, even with a `derived` source.
- A derived diameter is also unnecessary for the main use, the deviation view (#827): the interior run reads the bullet mass and the bore from the cartridge, not the bullet diameter.
- G1 is still the right key to group by. 235 of the 3,684 keys (6.4 %) occur with cartridges of different calibre (`Hornady V-MAX 40 gr` in .204 and .224), and the calibre is needed in the id and the name (section 4). G1 exists for 521 of 577 cartridge records, and 5,669 rows (8.3 %) have a cartridge without G1 or none, so for those the calibre token comes from the printed text or stays out of the key (128 keys have no cartridge diameter at all).
- Where a table prints a diameter or a calibre (Western, Norma), store it as printed (`diameter` with `raw`, or the calibre wording in `caliber`) with the table as its source and `fields` naming it. That is a published value, not a derived one.
- At use, the workbench may suggest the cartridge's G1 as a hint next to the empty field (section 5). The hint is shown, not stored.

## 4. Names and ids of name-only records

- Name: the type as printed, without the maker, plus mass and, where two records of one maker would otherwise collide, the calibre: `V-MAX 40 gr .224`. `checkNames` scopes bullet names by manufacturer and rejects exact and normalised duplicates (`packages/data/src/names.ts:54-71`, bullet scope at `:121-127`), so two records named `V-MAX 40 gr` fail. The name must carry the calibre whenever the key is not unique by itself. A stable rule is to always include it.
- Id: `<maker>-<type>-<grains>gr-<calibre>`, for example `hornady-v-max-40gr-224`, built by one function in the import tool and recomputed by a `data:validate` check, so a hand-edited id is caught. Full records use `<maker>-<product number>` (`hornady-10208`, `sierra-1032`). A collision of the two shapes is a same-file collision and fails already; the real hazard is a later full record of the same product.
- Spelling variants of one key across sources (`HDY V-MAX`, `Hornady V-Max`) are one record. Each table is a source of it with `fields: ["mass"]` and its printed wording in the source note. Merging bullets that several tables name differently with each other and with the bullet catalogue is listed under "Not yet specified" in #817 and is left there.
- Replacement: when a full record for the same product appears, the name-only file is deleted, and `records/renames.json` gets `bullets.<old id> -> <new id>`. `checkRenames` requires that the old id is no record and the new one is (`packages/data/src/renames.ts:57-69`), and a rename never chains, so a second rename rewrites the first entry. The API answers an old id with a 308 to the new record (`packages/api/src/openapi.ts:23,199`) and a user variant follows the map (`apps/web/src/lib/variants.ts:62`). A catalogue load or powder list that names the bullet is not covered: `checkLoadComponentReferences` accepts current ids only (`packages/data/src/references.ts:62-70`), so the rename and the rewrite of those references go in one change.
- A rename is one old id to one new id. A name-only bullet that fits several full products (`Hornady SP 150 gr` in .308 and .30-30) cannot be renamed to one of them and stays beside them. Choosing the target needs the type mapping of #826 and #829.
- Powder ids do not depend on a product number, so a powder gets its data in place under the same id. A rename is needed only if its name changes.

## 5. Workbench

Reads of the bullet today: the interior run needs `bulletMass` (`interior-input.ts:46`); the trajectory form requires mass and diameter (`apps/web/src/lib/trajectory-input.ts:152-153`) and needs a BC. The card shows the record's diameter and length as read-only rows (`apps/web/src/components/workbench-inputs.tsx:219-237`) and reads `b.diameter.value` without a guard.

Recommendation, building on #758 (every record value an editable field, with its changed mark and reset):

- Picking a name-only bullet fills the mass and any value the record has, and shows diameter, length and BC as empty editable fields with the placeholder "not in the record". #758's single helper for bullet values (its last bullet) is the seam: it returns `diameter` and the others as possibly absent, and the card, the trajectory input and the result header read it.
- Interior simulation and the deviation from the published rows (#827) run at once, with the mass only.
- The trajectory and the stability need a diameter, the trajectory a BC. Without them the result panel gives the reason in the pattern the BC case already has (`apps/web/src/lib/firearm-range-cards.ts:135`, "The bullet has no BC in the database."), here "Type the diameter and a BC to run the trajectory.", with the cartridge's G1 offered as a one-click suggestion labelled as the cartridge maximum. German text for every new string.
- Typed values are the user's, listed as typed (#758, provenance); they never change the catalogue record.
- Compute routes: `bulletSi` (`packages/api/src/compute/resolve.ts:30-36`) returns diameter as possibly absent, and `bulletProjectile` throws an `InputError` naming the missing diameter, as it already does for a missing BC (`resolve.ts:64-67`).
- Dependency: this needs the helper of #758 part 1. The two should share one pull request series, or this part waits for it.

## 6. Lists, search and record pages

- API: `BulletItem` and the `GET /v1/bullets` schema (`packages/api/src/catalogue/types.ts:160-171`, `packages/api/src/routes/components.ts:104-118`) make `diameter` `number | null`, as `length` already is, and carry `nameOnly: true` when set. The OpenAPI baseline changes, so the implementing pull request rewrites `packages/api/openapi.baseline.json` with `npm run api-baseline -w @open-reloading/tools` (`AGENTS.md`, API contract). Whether oasdiff flags the nullable response field as breaking is unverified.
- Search keeps working: the search key is the maker name plus the product name (`packages/api/src/catalogue/derive.ts:131-143`).
- Cartridge filter: `GET /bullets?cartridge=` keeps only bullets inside the cartridge's diameter window (`packages/api/src/catalogue/open.ts:65-82`), so a bullet without a diameter drops out of the list where users look for it. Replacement: the cartridges the tables list the bullet for, as `powder.listedCartridges` does for powders (`powder.ts:148-152`, with the source rule at `powder.ts:167-175`). A name-only bullet is shown for a cartridge when that cartridge is in its list. Whether the list is stored on the bullet or derived from the load rows at build depends on the row layout of #818 and #819.
- Mark: a plain line "Name only: diameter, length and BC are not in the record" (the fields the record lacks, from the data, not a fixed text) on list rows, in the picker and on the record page, with the source link to the table the name comes from. No icon-only mark, and no statement that the values would be safe or typical.
- Record page: `bullet-record-page.tsx:44` passes `b.diameter.value` to the compare link, which is left out without a diameter. Whether the bullet drawing can draw without one is not checked.
- Powders: the same mark text derives from missing data fields. A powder without `interior` already says "No fitted model parameters" in the comparison (`apps/web/src/components/use-powder-compare.ts:34,190`).

## 7. Reads of `diameter` and `productNumber` that change

Found by grep, not exhaustive: after the schema change `tsc` lists the rest.

- Schema: `bullet.ts:292` (cannelure depth against the radius), `:334` (every size check in `superRefine`, `d` is read before use).
- Data: `plausibility.ts:133`, `:184`.
- API: `derive.ts:194`, `open.ts:79`, `resolve.ts:33`, `types.ts:164`, `routes/components.ts:110` and the description at `:206`.
- Web: `api-types.ts:60`, `bullet-record-page.tsx:44`, `bullet-list.tsx:90,131`, `bullet-search-dialog.tsx:49-64`, `record-fields.ts:267,642`, `workbench-inputs.tsx:221-225`, `trajectory-input.ts:329`. `bullet-record-page.tsx:33` already guards `productNumber`.
- Docs: `apps/docs/docs/data/record-model.md`, section "Components without a catalogue match" (the line that allows a `{manufacturer, model}` description only in `measured` catalogue loads, and the user stubs), and a new section on name-only records. The description in `packages/schema/src/load.ts:124-130` stays for measured data. Published tables use name-only records instead, which `checkRecordReferences` (`load.ts:274-286`) would otherwise refuse for provenance `published`.

## 8. Questions for the owner

1. Are Alliant `Varmint` and Vectan `T8000` existing powders of those makers under another name? Until a maker statement says so, both become name-only powder records.
2. Bullets that print no maker (967 keys, 8,142 rows, 11.9 %): `manufacturer` is required by the bullet and by the load's `bulletDescription` (`load.ts:124-130`, which also names a manufacturer). Options: (a) no bullet record, the row keeps the printed text and mass (the interior run works, nothing links); (b) `manufacturer` optional for name-only records, which weakens the reference check and the name scope; (c) a manufacturer record meaning "not stated". Recommendation: (a) for the first import, decided with #819.
3. Diameter rule (section 3): store only a printed diameter, never the cartridge maximum. This is the recommendation; the alternative stores G1 as a `derived` value.
4. 21 makers need a manufacturer record before their bullets can be imported. Is a manufacturer record with only a name and the table as its source acceptable?
