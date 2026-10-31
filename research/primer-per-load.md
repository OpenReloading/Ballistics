# Primer per load: which sources print it, and where

Research note for wayfinder ticket #824 (map #817), 2026-10-31. Counts are over the 68,502 collected rows of 10 makers and the retrieved copies of their tables (retrieval dates 2026-10-12 and 2026-10-13). Evidence is the retrieved copies, not a re-read of the live pages: see "Live checks".

## Result

- Nine of the ten sources print the primer; only Norma prints none (2,394 rows, 77 cartridge pages). The primer is printed at five different levels: per row, per bullet block, per data page, per cartridge table header and per cartridge.
- The collected rows hold the primer for six makers (38,845 rows), as free text inside the `note` column, not as a column. For Western, Lovex and Vihtavuori the source prints it but the collected rows do not carry it (27,253 rows). #826 needs the primer as a column and these three read again.
- What is printed has four precision levels. Approximate row counts: brand and model about 52,400 (76 %), size class only about 13,660 (Vectan, Vihtavuori and a few Reload Swiss rows), brand without model 38, absent 2,416 (Norma 2,394, ADI 10, Reload Swiss 12 printed as `n.a.`).
- About 53 primer products from 6 makers appear (Winchester, Remington, Federal, CCI, RWS, Sellier & Bellot), in 174 distinct printed strings. The existing real records have manufacturer records for Winchester, RWS and Sellier & Bellot, none for CCI, Federal or Remington, and no real primer record exists (`apps/docs/docs/data/primers.md:28`).
- Recommendation: a row keeps the primer text as printed, plus an optional list of `catalogue:` primer references that an explicit alias table sets, plus `size` and `magnum` only where the printed text states a size class. Never a guess from the model number. Details under "Recommended shape".

## Where each source prints the primer

| Source (edition) | Level | Rows | Printed form | In collected rows |
|---|---|---:|---|---|
| Alliant, Reloader's Guide 2023 | per row (a Primer column of each bullet and powder line) | 2,056 | brand and number, `Fed. 210`, `CCI 200` | yes |
| Reload Swiss, web table 2026-10-12 | per row (column beside case and powder) | 2,190 | size class, brand, number: `LR RWS 5341` | yes |
| RWS, web table 2026-10-13 | per row (three columns) | 902 | same form as Reload Swiss | yes |
| Hodgdon, Annual Manual 2025 | per bullet block (header line `Case: ... Primer: ... COL: ...` above the powder lines) | 19,453 | brand, model, size words: `Winchester LR, Large Rifle` | yes |
| Vectan, catalogue 2023-12 | per bullet block (Primer column on the bullet line, powders below) | 1,932 | size class in words: `Large Rifle`; two blocks name `CCI 35` | yes |
| ADI, web pages 2026-10-13 | per data page (property table beside Case and Barrel Length) | 12,322 | brand, model, size words | yes, 10 rows absent |
| Western, Handloading Guide 8.0 | per table header (`Barrel ... Twist ... Primer: WIN WSR ... Bullet Diameter`) | 12,251 | brand code plus model code: `WIN WSR`, `FED 210M`, `REM 7½` | no |
| Lovex, Reloading Guide EN 37 | per cartridge header (`Primer: 5.3 LR Boxer S&B`) | 1,530 | diameter, size, pocket type, maker; a few `CCI ...` | no |
| Vihtavuori, reloading data tool 2026-09-14 | per cartridge (field `Primers` of the cartridge entry) | 13,472 | size class in words; 1,774 rows name a brand and number | no |
| Norma, web pages 2026-10-13 | not printed | 2,394 | none | not applicable |

Sources: Alliant https://www.alliantpowder.com/resources/catalog/AP399_2023AlliantPowderReloadersGuide_SinglePgsNoCrops.pdf, Reload Swiss https://www.reload-swiss.com/en/loading-data/rs-loading-data, RWS https://rws-ammunition.com/de/infotainment/wiederladen, Hodgdon https://hodgdonpowderco.com/wp-content/uploads/2026/04/AM25.pdf (header example `#page=76`), Vectan https://www.vectan.fr/images/files/NS-23-12-CATALOGUE-PP-WEB.pdf, ADI https://www.adiworldclass.com.au/data-rifle/ and `/data-pistol/`, Western https://hodgdonpowderco.com/wp-content/uploads/2023/04/WesternPowdersHandloadingGuide8.0_WEB-1.pdf, Vihtavuori https://vihtavuori.com/wp-content/uploads/2026/09/LecasyFile14.9.2026-10.34.48.json (the data file of https://vihtavuori.com/reloading-data/reloading-data-tool/), Norma https://www.norma-ammunition.com/reloading. Lovex: "LOVEX Reloading Guide for centre fire ammunition", Explosia a.s., edition EN 37, a PDF supplied by the owner; the download URL is not confirmed.

Facts that matter for the import:

- ADI: per page, and a cartridge can have two pages. `222 Remington` has a rifle page (`Winchester SR, Small Rifle`, 156 rows) and a pistol page with a 10 inch barrel (`Remington 7 1/2, Small Rifle Magnum`, 4 rows). The 41 Action Express page prints no primer (10 rows).
- Western: 164 `Primer:` headers, one of them in the how-to-read example on PDF page 24, so 163 table headers against 156 distinct (cartridge, barrel) groups in the rows. Every cartridge that has rows has a header at or before its first page. The pages without a header (29, 37, 50, 51, 73, 74, 76) are marked `(continued)`: the header is not repeated. The gap of 7 between headers and groups is not explained (unchecked, likely tables of one cartridge with two bullet diameters).
- Lovex: 51 clean headers on the handgun and rifle pages 6 to 42, plus the two cartridges of page 37, whose two overlaid text layers give scrambled header text (`4.4`, `4.4 SR`, `3.05`, `5.3`): the primer of those 12 hand-transcribed loads has to be read off the rendered page. Rows exist for 53 cartridge names, so every cartridge has a header. The shotgun pages 43 to 46 print `CCI 209 SC` and `Martignoni 684` / `688`; they are shotshell primers, were never read, and stay out (the map excludes shotshell tables).
- Vihtavuori: the field is per cartridge (112 cartridges, none empty). 11,698 rows carry a size class only. A few entries list several primers, for example one cartridge lists `Small Rifle Magnum, Remington 7 1/2 BR, CCI 450`. The data also holds free text such as a recommendation to use a primer in cold temperatures: that is advice, not a value, and is not imported.
- Hodgdon: the primer sits in the header of a bullet block with the case and COL, so it can differ between two blocks of the same cartridge and bullet (a different case or primer). Vectan: the primer is on the bullet line only, with no case, and none of its blocks has two primers. Alliant prints it per line, and the primer differs between powders of one bullet (93 bullet groups, magnum powders with `Fed. 215` next to standard ones with `Fed. 210`).
- The Hodgdon online Reloading Data Center was not collected (the manual covers the same powders); whether it prints the primer is unverified.

## Printed names that resolve to no product

Counts of printed strings, not rows. None is corrected: the printed text stays, the reference stays empty.

| Case | Strings (rows) |
|---|---|
| No brand | Alliant `210` (2), `WSR` (1), `205MAR` (13); Lovex page 37 `4.4`, `4.4 SR`, `3.05`, `5.3` |
| Typo | Alliant `Fed.. 210` (1) |
| Brand and size class, no product number | Reload Swiss `SR CCI` (14), `LR CCI` (12), `LR S&B` (12) |
| Size class only | Reload Swiss `LR` (8), `LRM` (28); Vectan 8 classes (1,930); Vihtavuori (11,698) |
| Absent | Reload Swiss `n.a.` (12), ADI 41 Action Express (10), Norma (2,394) |
| Two primers in one row | RWS `RWS 5333 und 5341` (6) |
| Possible misprint, kept as printed | RWS `LR RWS 5431` (4), `LR RWS 5342` (2), Reload Swiss `RWS 8212` (12), Alliant `Win. LRP` (7) |
| Unclear size | `CCI 35, 50 BMG` and `CCI No. 35`: fits none of the five `primerSizes` |

The remaining strings name a brand and a model. After normalising brand spelling (`Win.`, `WIN`, `Winchester`; `Fed.`, `FED`, `Federal`; `REM`, `Rem.`, `Remington`) and model spelling (`7 1/2`, `7½`), they are about 53 products: Winchester 6 (SR, SP, LR, LP, LRM, SPM), Remington 8 (1½, 2½, 5½, 6½, 7½, 7½ BR, 9½, 9½M), Federal 13 (100, 100M, 150, 150M, 155, 200, 205, 205M, 210, 210M, 215, 215M, GM150M), CCI 11 (35, 200, 250, 300, 350, 400, 450, 500, 550, BR2, BR4), RWS 10 (4031, 4033, 4047, 4066, 5333, 5337, 5341, 5342, 5431, 8212), Sellier & Bellot 5 (4.4 SP, 4.4 SPM, 4.4 SPMP, 5.3 LR, 5.33 LP). Count is by hand from the strings, 3 of the RWS numbers occur once and may be misprints, so 50 to 53. Remington `7 1/2` and `7 1/2 BR` are counted as two products; ADI prints `Remington 7 1/2, Small Rifle Magnum` for the first, which is the printed text and is kept.

## What the schema offers

- `Load.primer` is `{ lot?, record? }` with `record` a `catalogue:` primer reference (`packages/schema/src/load.ts:196-202`). It is a strict object with no place for the printed text, for a second primer, or for a size class without a record. A load may omit the primer, so an absent primer stays absent (`packages/schema/src/load.ts:251-259`: a catalogue load needs id, name, provenance, cartridge, bullet, powder and charge, no primer).
- `primer` records need `manufacturer`, `name` and `size` (`packages/schema/src/primer.ts:57`); `magnum` is optional. `primerSizes` holds `small-rifle`, `large-rifle`, `small-pistol`, `large-pistol` and `shotshell` (`primer.ts:10-16`). There is no size for `CCI 35` (50 BMG), and no `match` or `benchrest` flag (they fit only `note` or `intendedUse`).
- `data:validate` already reports a load whose `primer.record` names no primer (`packages/data/src/references.ts:73-86`).
- No real primer record exists, and `apps/docs/docs/data/primers.md:28` says no primer source was found whose terms allow publishing. The earlier source note (`research/component-data-sources.md`, branch `research/component-data-sources`) found that primer pages of makers print size class and product numbers only, no cup or composition values. The owner has since decided that maker data goes public with the maker as source; this note assumes that decision covers primer names and sizes as printed in a powder maker's load table. Unverified legal reading.

## Recommended shape (input for #819 and #826)

1. Row field `primer`, optional. Absent in the source means absent in the row, including `n.a.` (the printed `n.a.` is kept in `printed` only if the owner wants to tell "printed as not applicable" from "not printed"; recommended: omit it).
2. Inside it: `printed` (text as the source prints it, required, one string, so `RWS 5333 und 5341` stays whole); `records` (optional list of `catalogue:` primer references, one or more); `size` and `magnum` (optional, set only when the printed text states a size class, such as `Large Rifle Magnum` or `LRM`).
3. `records` is set only through an explicit alias table, one entry per printed string, with no fuzzy matching, the same discipline the cartridge and powder mappings use. A brand and size without a product number (`SR CCI`) gets `size` and no record. A size class alone (`Large Rifle`) gets `size` and `magnum` and no record. A typo or code without a brand (`210`, `WSR`) gets `printed` only.
4. A row never takes `size` from a primer record or from the model number (`Fed. 210` prints no size): the size of a branded primer belongs on its record and needs a source of its own.
5. The level at which the source printed it (per row, block, page, header, cartridge) is copied down to each row and not stored. The re-import then works on rows, and the level is reproducible from the source and edition.
6. Create name-only primer records for the resolved products (manufacturer, name, `size`, `magnum`, a `provenance` citing the load table page) for the ~53 products, each field sourced from a table that prints it. Hodgdon and ADI print brand, model and size words together, so most products get `size` from the same table that names them. This needs the manufacturer records for CCI, Federal and Remington (Winchester, RWS and Sellier & Bellot exist among the existing real records). Do not fill `cup`, `compound` or `performance`: no table prints them.
7. Validation for #826: `primer.records` resolve; `printed` is non-empty whenever `records`, `size` or `magnum` is set; a size or magnum on a row agrees with the size and magnum of each record it names (a conflict is reported, not repaired).
8. Schema gaps to decide with #819: allow `Load.primer` to carry `printed` and several records, or give rows their own primer shape; add a size for the 50 BMG primer or leave `CCI 35` without a record (18 collected rows print `CCI 35`, plus the Lovex `.50 Browning` table); a place for `match` and `benchrest` (the printed word stays in `printed`).
9. A primer plays no part in a solver (`primers.md:8`), so it is not part of the fit and the hold-out split is unaffected. It is shown beside a row, and available as a filter.

## Work this puts on #826

- Add the primer as a column in the collected rows; read it again for Western (163 table headers), Lovex (53 cartridges, page 37 by eye from the rendered page) and Vihtavuori (112 cartridge entries); Norma stays empty.
- Build the alias table for the 174 printed strings (about 53 products plus the unresolved cases above).
- Re-import reports a changed primer like any other changed field.

## Open points

- Owner decision: does the import create name-only primer records (and the manufacturer records for CCI, Federal and Remington) from the load tables, or do rows keep the printed text only until a primer source is chosen? The map promises name-only records for bullets and powders, not for primers.
- The three RWS numbers that occur once (5342, 5431, 8212), `Win. LRP`, `205MAR` and Lovex `CCI 209 SC` were not checked against the makers' primer ranges.
- The Hodgdon online data center, and the current Reload Swiss table (see below), were not re-read.

## Live checks

On 2026-10-31, with robots.txt of Reload Swiss read (no rule blocks `/en/loading-data`):

- The Norma page for the 308 Winchester now says its load data is temporarily removed while it is reviewed and updated. The copy collected on 2026-10-13 holds the table, so a re-import can see a withdrawn table (relates to the open point on withdrawn rows in the map).
- The Reload Swiss page now states "1,120 load data online" with the latest update 2026-10-20, which is newer than the collected copy of 2026-10-12. The table is built from script state, so the fetch tool could not show a row or a column header: the per-row primer column rests on the retrieved copy.
- The ADI fetch failed twice with no output, so the property table rests on the 274 retrieved pages (273 print a primer, one does not).
