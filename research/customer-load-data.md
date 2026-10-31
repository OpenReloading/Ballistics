# Maker data and customer data in published load tables

Research note for wayfinder ticket #820, read on 2026-10-31. Evidence tags: `[read]` the text or table was read in full for the point, `[summary]` only a fetch tool's summary of the page was available, `[rows]` counted in the collected maker load tables (68,502 rows of 10 makers, collected 2026-10-12 and 2026-10-13). Rights readings are unverified and are not legal advice.

## Result

- One of the 10 collected makers publishes customer loads: Reload Swiss. The other nine state, or their rows show, no customer submissions. For five of them (Vihtavuori web tool, RWS, Norma, ADI, Lovex) no producer statement was found, so "no customer data" is not proven for those.
- Reload Swiss keeps the two apart by page, not by a column. The maker's own table is `https://www.reload-swiss.com/en/loading-data/rs-loading-data`, the customer table is `https://www.reload-swiss.com/en/loading-data/customer-loading-data`. Both tables have the same columns, in the same order. The customer page adds a legend entry `*+` ("Tested by a state proof-house or DEVA") that the own page lacks.
- The collected Reload Swiss rows (1095 table rows, 2190 start and maximum rows, retrieved 2026-10-12) come from the own page only. They hold no customer row. Evidence: the collected URL, no `+` mark in any of its remarks, and the customer table is a different page and was not collected `[rows]`.
- Nothing mixes the two without a mark. The only source that holds both separates them by URL, and the separation is complete on both pages read.
- Recommendation: keep the two as separate load tables, add one table-level field for who produced the loads and one row-level field for the proof-house test, show customer rows marked, and keep them out of fits, gates and the validation statistics until the owner decides otherwise. Details under "Recommendation".

## Reload Swiss

Snapshots: collected own page 2026-10-12 (1095 table rows). Live own page parsed 2026-10-31, page text "1,120 load data online", updated 2026-10-20 `[read]`. Live customer page parsed 2026-10-31, page text "1,543 load data online", dated 2026-10-26 `[summary]`, 1543 table rows `[read]`. robots.txt disallows only two newsletter tracking parameters and `/_Dummy/` `[read]`; one GET per page, under one request per second.

What the pages say:

- Customer page: it carries "Our team cursorily reviews this information for plausibility, but we do not verify it through our own shooting tests." `[summary]` The submit page says "We check the information before the publication for plausibility." and asks that velocity be measured "only few metres away from the muzzle" `[summary]`. Nothing says how pressure is measured.
- The submit form asks for caliber, bullet weight, bullet maker and type, case maker, primer, powder, start and maximum load with V5 and pressure, barrel and COL information, plus name and address. Maximum load, V5, maximum pressure, barrel and COL are marked mandatory. It states no licence or rights for the submitted data and no terms for republishing `[summary]`.
- Legend on the customer page: `*C` compressed, `*IP` IPSC, `*HP` high pressure, `*OL` COL longer than C.I.P., `*+` tested by a state proof-house or DEVA `[summary]`. The legend of the own page has the first four only `[summary]`.
- Own page: it does not say who produced the values, whether they were shot or calculated, or how pressure was measured `[summary]`. It names only Nitrochemie Wimmis AG as the propellant maker. A separate article says Reload Swiss calculates loads on request with ballistics software for cases the tables do not cover, and does not say whether the published tables are shot or calculated `[summary]`. So "maker data" here is read from the page separation, not from a statement of the maker.

What the tables hold (parsed from the embedded page table, `[read]`):

| | Own table | Customer table |
|---|---:|---:|
| Rows (loads) | 1120 | 1543 |
| Calibers | 76 | 156 |
| Rows with a start load | 1120 | 458 |
| Rows with a start pressure | 1120 | 9 |
| Rows with a maximum pressure | 1120 | 151 |
| Rows with `+` | 0 | 163 |
| Maximum-pressure rows that are `+` | 0 | 129 of 151 |
| Fill ratio column filled | 1120 | 0 |
| Mark values seen | `C`, `HP`, `IP`, `OL`, `Polygon`, `.311` | `C`, `HP`, `IP`, `OL`, `+`, in several combinations |

- The pressure column is mostly empty in the customer table although the form marks maximum pressure as mandatory. The page does not explain this.
- 129 of the 151 customer pressures sit on `+` rows, so a pressure with a stated third-party test exists in 129 rows, a pressure without it in 22.
- 691 customer rows lie in 116 calibers without any row in the own table, and 752 rows in caliber and powder pairs without one.
- Scatter against the maker's rows: for 401 customer rows a maker row exists with the same caliber, powder and bullet weight rounded to the grain. Against the maker row with the nearest maximum charge, the customer's maximum charge differs by a median 0.0 % (10th to 90th percentile -6.1 % to +4.7 %), and the V5 by a median -0.1 % (-8.7 % to +5.7 %). The customer charge is higher in 175 of the 401 and more than 5 % higher in 38. This match ignores bullet type, COL, barrel and case, so it shows scatter between the tables, not an error of either.

## The other nine collected makers

| Maker, source | Statement on who produced the loads | Customer data marked or mixed |
|---|---|---|
| Hodgdon (Annual Manual 2025, covers Hodgdon, IMR, Winchester, Accurate, Ramshot) | "Ballistic data shown in this manual was obtained in the Hodgdon laboratory under strictly controlled conditions." `[read]` | None. The site offers a "Submit Load Request" form, a request to the maker, not published data `[summary]`. |
| Western Powders (Handloading Guide 8.0) | Loads "generated at the ballistics test facilities of Western Powders, Inc." under SAAMI guidelines, fired through test barrels `[read]` | None stated; no mark in the rows. |
| Vihtavuori (Reloading Guide 2024, reloading data tool JSON) | Guide: "obtained in laboratory conditions following strictly the CIP" rules `[read]`. The web tool page states no producer `[summary]`. | None. Markers: `A` accuracy load with Lapua components, factory tested, `C` compressed, `F` case full `[read]`. `*` is not explained in the guide text read or on the tool page, so its meaning is open. The guide's "Personal Loads" pages are blank forms for the reader. |
| Alliant (Reloader's Guide 2023) | "All loads have been tested in our ballistics lab with SAAMI approved, un-vented test barrels." `[read]` | None stated; no mark in the rows. |
| Vectan (catalogue 2023-12) | Tables "prepared in the Nobel Sport laboratories according to CIP Rules", fired in proof barrels `[read]` | None stated; no mark in the rows. |
| RWS (web table) | No producer stated; disclaimer and a note that pressure testing moved from crusher to piezo transducers `[summary]` | No submission feature or terms seen on the page; no mark in the rows. |
| Norma (web pages, one per cartridge) | No producer stated for the loads `[summary]`. Some cartridge pages say the data are "temporarily removed" while reviewed (relevant to the withdrawal question, not to this one). | No mark in the rows. |
| ADI (web pages) | Not re-read: the site did not answer on 2026-10-31. | No mark in the rows. |
| Lovex (Explosia guide, owner's copy) | Not re-read: the copy is not at hand. | No mark in the rows. |

Rows: none of the 68,502 collected rows carries a flag or note about a customer, user or third party. The only origin-like markers are Vihtavuori `A` (16 rows), `F` (117) and `*` (8) in the flags, and Reload Swiss `IP`, `HP`, `OL`, `C` in the notes `[rows]`.

## How the record keeps them apart today

- A source carries `origin` (`manufacturer`, `public`, `community`), `publisher`, `title`, `url`, `retrieved` and `terms` (`packages/schema/src/provenance.ts:17`, `:37`, `:98`). `docs/data/record-model.md:77` and `:295` rename the citation's `origin` to `standing`; the rename has not landed.
- `manufacturer` is defined as "data it supplied or published, used with its permission" (`provenance.ts:12`). That does not say who measured. Customer rows published by the maker fit the definition and still are not the maker's measurements.
- `community` is unused in the records (`packages/data/records/sources` holds one `public` source) and the map lists "loads our users share" as not yet specified. Using it for maker-republished customer rows would settle that open item by accident.
- A load table entry (`packages/schema/src/load-tables.ts:10`) holds `manufacturer`, `title`, `url` and `retrieved`. Nothing says who produced its loads.
- A fitted powder source must name a listed load table (`packages/data/src/load-tables.ts:6`, `:27`). This is where the gate belongs: it already decides which tables a fit may cite.
- The hold-out rule works on cartridge ids, and a row inherits its cartridge's split. Customer rows do not move any split; they only matter if fits or gates read them.

## Recommendation

Proposal for the owner and the row-shape ticket, names to be settled there:

1. Two load table entries for Reload Swiss, one per URL, the customer entry titled as such. The URL already separates them, so no row needs a guess.
2. A table-level field for who produced the loads, for example `producedBy` with `maker` or `customer`. It is separate from the citation's standing, which answers who stands behind the data and under what permission. Leave the choice of standing for customer tables open (see questions).
3. A row-level field for the proof-house test, for example a boolean taken from `*+`. The raw mark text stays in the row's remark as printed, like the other marks.
4. Treatment:
   - Fits, model gates and the hold-out statistics read rows of tables with `producedBy: maker` only. The fit tooling filters by table before it filters by split, so a customer row cannot reach a fit through a cartridge that has no maker rows.
   - The workbench lists customer rows in their own group with a visible "customer load" label and the proof-house mark; the deviation view shows maker rows by default and customer rows on request.
   - The validation report gives customer rows their own line (rows, median deviation, spread) so the effect of including them is visible, and no gate uses them.
   - Pressure of the 129 `+` rows is a candidate for pressure validation once the method is known; the page does not state it.
5. Reason: the maker states that it does not verify these loads by its own shooting, the pressure column is almost empty and its method unstated, the velocity is stated as measured "few metres" from the muzzle, and 38 of 401 comparable rows exceed the maker's own maximum charge by more than 5 %. The map's rule that fits read training rows from maker tables, and that the test split is read once, is easier to keep when the customer rows never enter.

## Open points and owner decisions

- Whether customer rows are imported at all. They are submissions of private persons republished by the maker; the submit page states no licence or terms for republishing, so the maker's own permission may not cover them. A written question to Reload Swiss (permission requests, #297) settles it.
- Which standing the customer table gets (`manufacturer`, `community` or a new value), once the rename to `standing` and the user-shared loads question are decided.
- Whether `+` rows may enter pressure validation.
- Reload Swiss's own table: ask whether its values were shot or calculated, and how pressure was measured. The page says neither.
- Vihtavuori `*`: ask or read the app's legend. Until then the flag stays "meaning not stated".
- Not checked: ADI and Lovex statements, RWS and Norma beyond the page summary, the Hodgdon web data center (its terms say all information is proprietary and prohibit scraping and redistribution `[summary]`, outside this ticket, and the collected Hodgdon rows come from the Annual Manual PDF, not from the data center), and the terms of the Annual Manual and of Vectan's catalogue (which says reproduction in print or on internet files needs prior written approval `[read]`).
