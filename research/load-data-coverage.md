# Load data coverage and missing sources

Research for ticket #822 of the wayfinder map #817. Read on 2026-10-31. Counts come from the collected maker load tables (68,502 rows from 10 makers) compared with `packages/data/records/cartridges` on `main` (577 cartridge records). Source facts come from the makers' own pages, fetched at most a few times each. Where a number is an estimate, it says so.

## Answer

1. The collected rows reach 241 of the 577 cartridge records. 336 have no row. Most of those 336 are cartridges no current maker table lists (rimfire and blank loads, historic British, German, Austrian, French and Russian cartridges, wildcats). More maker tables will not close that gap; they add depth (more bullets and powders per cartridge, more pressure values) to cartridges that already have rows.
2. 54 covered cartridges have rows from one maker only, and 62 have no pressure in bar (25 only with CUP values, 37 with none).
3. The highest yield per hour is in single documents: the Berger quick reference sheet (about 110 bullet records from one 5-page PDF), the Hodgdon burn rate chart (about 25 name-only powder records), the nine Accurate data sheets, and the Shooters World manual.
4. The highest row counts are Barnes (138 PDFs), Nosler (about 125 cartridge pages), Hammer (about 211 Google Sheets) and Sierra (170 PDFs). Nosler, Sierra and Berger state terms that restrict copying or scraping. Hodgdon's online data center forbids automated scraping in so many words. These need an owner decision, listed at the end.
5. Do not read the Hodgdon Reloading Data Center, the Berger site, or the Western Powders site. The first forbids it; the second forbids it in its terms; the third currently serves a gambling advertisement as its home page.

## Coverage today

### Rows

| Maker | Rows | Cartridges | Pressure (bar) | CUP | COAL | Barrel |
|---|---|---|---|---|---|---|
| Hodgdon (Annual Manual 2025) | 19,453 | 98 | 14,592 | 4,854 | 19,453 | 19,453 |
| Vihtavuori | 13,472 | 105 | 0 | 0 | 13,472 | 13,472 |
| ADI | 12,322 | 192 | 5,510 | 5,942 | 12,296 | 12,322 |
| Western (guide 8.0) | 12,251 | 131 | 6,090 | 27 | 12,251 | 12,231 |
| Norma | 2,394 | 74 | 0 | 0 | 2,226 | 0 |
| Reload Swiss | 2,190 | 74 | 2,190 | 0 | 2,188 | 2,118 |
| Alliant (2023) | 2,056 | 100 | 0 | 0 | 2,053 | 0 |
| Vectan (2023-12) | 1,932 | 101 | 0 | 0 | 0 | 0 |
| Lovex | 1,530 | 53 | 765 | 0 | 1,530 | 1,530 |
| RWS | 902 | 30 | 0 | 0 | 902 | 896 |

Pressure is printed by five of ten makers. Vihtavuori, Norma, Alliant, Vectan and RWS print none: 28,532 rows (42 percent) carry no pressure, and 10,823 more carry a CUP value that has no conversion to bar. Only 29,147 rows (43 percent) can test a pressure prediction. 2,615 rows (81 printed cartridge names, almost all wildcats such as 22 GT, 6.5mm-06, 6 x 45 mm) have no cartridge record. 3,054 rows belong to 16 cartridge ids that exist as SAAMI cartridges (for example 22 Creedmoor, 6mm GT, 277 SIG Fury, 327 Federal Magnum) but have no record in `packages/data/records/cartridges` on `main`; they are in the row counts above and not in the counts of the 577.

### Cartridge records

| Group | Cartridges |
|---|---|
| Records on `main` | 577 |
| With at least one row | 241 |
| With no row | 336 |
| With rows from one maker only | 54 (ADI 17, Vectan 11, Norma 8, Reload Swiss 8, Vihtavuori 4, Lovex 3, Western 2, Hodgdon 1) |
| With rows but no pressure in bar | 62 (25 CUP only, 37 none) |
| With 30 rows or fewer | 66 (31 with 10 or fewer) |

By hold-out split (first byte of the id hash, as fixed for the interior models): the 336 without rows are 192 training, 77 test and 67 validation cartridges, of 339, 129 and 109 in total. Covered cartridges per split: 147 training, 42 validation, 52 test; with pressure in bar: 105, 35 and 39. The once-per-version test read rests on 52 cartridges, 39 of them with pressure values.

A rough sort of the 336 by id (heuristic, not reviewed one by one): 54 rimfire, blank, flobert or bare-number records; 64 historic names (Nitro Express, Rigby, Holland, Sharps, rim-fire era, belted H&H, old Winchester single shot); 218 others, mostly European and Russian military and hunting cartridges (8 x 57 I, 8 x 60 R, 9.3 x 53 R, 7 x 72 R, 5.6 x 61 SE v. H, 7.62 x 45) and some current ones. The current cartridges in that last group that are the likeliest to appear in US maker tables: 25 Remington, 30 Remington, 32 Remington, 35 Winchester, 33 Winchester, 303 Savage, 375 Blaser Magnum, 408 CheyTac, 416 Ruger, 416 Taylor Magnum, 5 mm Remington Magnum, 50-70 Government, 40-60 Winchester, 45-60 Winchester, 45-75 Winchester, 45-90 Winchester. Whether the new sources list them is unverified until each index is read (one request per index).

### Bullets

The rows name bullets as printed (1,781 distinct strings; 4,750 distinct bullet and mass pairs). Bullets by maker, counted from the printed names by a text match (rough):

| Maker | Rows | Distinct printed names | Existing bullet records |
|---|---|---|---|
| Hornady | 14,274 | 212 | 314 |
| Sierra | 10,771 | 160 | 240 |
| Nosler | 7,447 | 136 | 1 |
| Barnes | 6,049 | 116 | 0 |
| Speer | 5,190 | 130 | 0 |
| Berger | 4,301 | 136 | 2 |
| Lapua | 3,238 | 62 | 1 |
| Norma | 1,258 | 79 | 0 |
| RWS | 1,254 | 31 | 0 |
| Sellier and Bellot | 970 | 47 | 105 |
| Swift | 862 | 13 | 0 |

The existing real bullet records (1,684 in total, not yet in the public repository) also include Cutting Edge 354, Hammer 318, Missouri Bullet 195, Lehigh 131 and Sako 23; the rows name few of those bullets. The largest uncovered row counts are Nosler, Barnes, Speer, Berger and Lapua, 25,000 rows between them.

### Powders

The rows name 282 powder spellings; 246 powders match a powder record (247 records exist). Rows with no powder record: Alliant "Varmint" (14), Vectan T8000 (6), Norma "-" (28, a dash printed in the source) and one Norma Blaser brass entry (2). The maker burn rate chart (below) lists 175 powders; by a name match (heuristic) about 25 of them have neither a record nor a row: Alliant Reloder 12, 15.5, 23, 50, Extra-Lite, Steel, e3, Promo, Clay Dot, 20/28, Pro Reach, 410; IMR 4166, 4451, 4955, 7977, 8133; Hodgdon Perfect Pattern, High Gun, International; Norma R1, R123, 205, MRP2; Winchester Super Handicap. Six more the match flagged turned out to have records under another spelling, so each name needs a hand check. Several are shotshell powders (out of scope for load rows, still valid name-only records).

## Source survey

Terms were read from the makers' own pages (a short page fetch each); quotes are from those pages. The owner should read each terms page once before the import. robots.txt was fetched for every host on 2026-10-31 with the user agent `OpenReloadingResearch/1.0 (+https://github.com/OpenReloading/Ballistics)`.

| Source | Format and extent | robots.txt | Terms |
|---|---|---|---|
| Hodgdon Reloading Data Center, `hodgdonreloading.com/rldc` | HTML lookup (rifle, pistol, shotgun) | Crawl-delay 10, no path blocked | Footer: "All Reloading Data Center information is proprietary to Hodgdon Powder Co. Use of this data is strictly limited to personal, non-commercial purposes. Any automated scraping, redistribution, or incorporation into third-party platforms, software, or apps without written consent is prohibited and may result in legal action." (read verbatim from the page) |
| Hodgdon manuals library, `hodgdonpowderco.com/reloading-manuals-library/` | 12 PDFs: Annual Manuals 2017 to 2025, muzzleloading; the 2026 manual is print only | Crawl-delay 10 | PDFs not read for terms; 2025 is collected, 2017 to 2024 are older editions of the same tables |
| Accurate data sheets, `hodgdonpowderco.com/accurate/` | Per-powder PDFs from April 2023: DP68, DP73, DP74, DP79, DP85, DP86, DP2200, DP2230-C, 2230-S, plus Nitro 100 and Solo 1000 bushing data, TCM and 11FS | as above | Not read. DP68 sheet read: 4 pages, "Time supplied: December 2005", start and maximum loads with velocity, PSI and COL, surplus military powder |
| Shooters World manual, `shootersworldpowder.com/wp-content/uploads/2023/06/ShootersWorldManualInterior_CHRIS_WITH-COVER__RUSS-REVISED.pdf` | 52 pages, 11.5 MB, Lovex powders (Clean Shot, Competition, Blackout, Tactical Rifle, Match Rifle, Precision); start and maximum charge, velocity, load length, PSI on handgun tables; 24 inch test barrel on some tables; about 670 load lines | `Disallow: /*?`, Crawl-delay 10 | No terms page linked; footer copyright only. Different from the Lovex European guide already collected |
| Shooters World Vectan catalogue 2025 (US) | 48 pages, shotshell tables only | as above | Out of scope: shotshell. The collected 2023-12 Vectan catalogue holds the metallic tables |
| Somchem, `somchemreload.com` | HTML per weapon type and caliber (64 calibers, 5 weapon types: conventional rifle, monolithic, Barnes TSX, handgun, shotgun); 12 powders (S385, S365, S361, S355, S341, S335, S321, S265, S221, S121, MS200, MP200); columns powder, case, primer, bullet, COL (mm), start or max, charge (gr), velocity (ft/s), V/C factor; barrel length printed (24 inch on the page read); no pressure | `Disallow: /search/` and Crawl-delay 10. The data URLs are `/search?c=..&f=..`, which do not start with `/search/`; read as allowed, but the owner should confirm | Disclaimer page only (Rheinmetall Denel Munition): data compiled under controlled conditions, no liability. No copying clause. The page shows "The website encountered an unexpected error" |
| Barnes, `barnesbullets.com/load-data/` | 121 rifle and 17 handgun PDFs, for example `.../content/barnes-loaddata/rifle/308/30-06Springfield.pdf`. The 30-06 file is 8 pages: case, primer, trim length, barrel (24 inch, Bartlein), twist, COAL, ballistic coefficient and sectional density per bullet, minimum and maximum charge with velocity, "C" for compressed; about 87 charge pairs; no pressure | Blocks account and cart paths only; Crawl-delay 10 for a list of AI crawlers, not for other agents | No terms page linked; the page has a disclaimer that the data is for use with Barnes bullets |
| Nosler, `nosler.com/load-data` | Index lists 111 rifle and 14 handgun cartridges; each cartridge page links one PDF per bullet weight (about 9 for the 30-06). One PDF read: one page, "Version 9.0", maximum SAAMI and tested COAL, BC, SD, case water capacity, primer, 24 inch barrel and twist, three charges per powder with velocity and load density, maximum flagged; no pressure; about 24 rows per PDF | Empty file, nothing blocked | Website use policy: "Permission is granted to electronically copy and to print hard copy portions of this website for the sole purpose" of ordering; any other use "without prior written permission of Nosler Inc. is strictly prohibited" |
| Hammer, `hammerbullets.com/load-data/` | About 211 Google Sheets, one per cartridge. The 308 Winchester sheet read as CSV (424 lines): barrel 24 inch, case length, SAAMI COAL, per bullet the minimum COAL, G1 or G7 BC and twist; per powder start charge, fill percent, start velocity and "velocity at max" (the maximum charge itself is not in the columns read); no pressure | `docs.google.com` allows `/spreadsheet`, Crawl-delay 1; hammerbullets.com blocks only WooCommerce paths | No terms for the data; the page says the company is not responsible for how it is used and that not all data is available yet |
| Sierra, `sierrabullets.com/load-data/` | 170 PDFs (128 rifle, 42 handgun), Sixth Edition, for example `.../content/load-data/rifle/308/308-winchester.pdf` (14 pages, 2.2 MB). Not start and maximum rows: a grid of powder against target velocity (2800, 2900, ... fps) giving the charge, maximum marked; COAL per bullet; barrel, case, primer, trim length; no pressure | Cart and account paths blocked; Crawl-delay 10 for a list of AI crawlers | Every page of the PDF carries a diagonal watermark that reads, in its scattered letters, "This data is for individual use only" (reconstructed from the extracted characters). The page has a disclaimer, no copyright clause |
| Berger load data, `bergerbullets.com/reloading-data/` | 26 cartridges as per-cartridge PDFs (Classic Hunter, Elite Hunter, 338) plus a 1st edition manual | No path blocked | Terms and Conditions section 12(i) prohibits "spider, crawl, or scrape"; section 2 prohibits reproduction of "any portion of the Service" |
| Berger quick reference sheet 2020, `bergerbullets.com/pdf/Quick-Reference-Sheets.pdf` | 5 pages, 112 part numbers: bullet diameter, OAL, boat tail length, nose length, base to ogive, bearing surface, sectional density, G1 and G7 BC, form factor, optimal twist. Already the source of two bullet records | as above | Same site terms; the PDF has no copyright line |
| Lapua catalogue 2026, `lapua.com/wp-content/uploads/2026/06/Lapua_Catalog_2026_ENG_web.pdf` | 19 pages, 16 MB: bullets (mass, diameter class) and factory cartridges with product number, bullet, muzzle velocity, G1 and G7 BC, test barrel length for the rimfire tables. Not load data; factory loads give velocity points | No path blocked | Legal notice: "Duplication, distribution, alteration or alternative use without a prior written consent from Nammo Lapua Oy is prohibited." |
| Hornady, `hornady.com/support/load-data/` | Handbook data is sold (app from 99 cents per cartridge, 12th edition book). Free PDFs: Basic Rifle Data, Basic Pistol Data, ECX data, 8.5x55 Blaser data, four A-Tip Match PDFs. Not read | Blocks asset, script and cart-type paths only | Terms of use (2018): lawful use, no reuse clause found, no scraping clause found |
| Speer, `speer.com/reloading/rifle-data.html` | The page is a shell: the data does not appear in the HTML (a commerce platform page, likely loaded by script). Not read | Account, cart and search refinement paths blocked | Footer "All Rights Reserved", terms on the parent company site, not read |
| Hodgdon burn rate chart, `hodgdonpowderco.com/wp-content/uploads/2024/08/Copy-of-2024-Smokeless-Relative-Burn-Rate-Chart-WEBSITE.pdf` | 2 pages, 175 powders of Hodgdon, IMR, Winchester, Accurate, Ramshot, Alliant, Norma and Vihtavuori in burn order (revised July 2024) | Crawl-delay 10 | Not read; a name list |
| Western Powders, `westernpowders.com` | The home page title is a gambling advertisement and the page carries 68 matches for it. Treat the site as compromised and do not browse it. Guide 8.0, already collected, is hosted by Hodgdon | `Disallow:` empty | Not applicable |
| Lehigh Defense | `lehighdefense.com` now redirects to a Wilson Combat page. No load data found | Not applicable | Not applicable |
| H&N | Home page shows no load data or bullet specifications (air gun and sport bullet lines) | Not applicable | Not read |
| Cutting Edge, Swift | Shopify stores; robots.txt allows all public pages. Cutting Edge answered 429 once during this research; its load data page was not read | Allows | Not read |
| RWS | Collected. The robots.txt blocks a list of AI crawlers (including ClaudeBot) with `Disallow: /`; other agents are not listed | see left | see left |
| Explosia and Nobel Sport hosts | `robots.txt` returned 403 and 404 | Unknown | Not read |

Not read: Alliant's online data pages beyond the 2023 guide, Winchester and IMR online tables (the same data center as Hodgdon), Norma bullet specifications, Woodleigh, North Fork, other bullet makers.

## Ranked list

Yield is rows or records gained per hour of work (my estimates, unverified for anything not read). The reading method is the one a collector would use: a PDF text read with the page layout kept, a column parse, and every printed value kept in `raw`. Hours cover a collector, a check against the printed page for a sample and the records, not the review.

| Rank | Source | Gain | Hours | Gain per hour | Method and requests | Gate |
|---|---|---|---|---|---|---|
| 1 | Berger quick reference sheet | about 110 bullet records (112 part numbers, 2 exist) with full dimensions and G1 and G7 | 2 | 55 records | 1 PDF request, layout text read, fixed columns | Site terms bar scraping; the PDF is one document already cited |
| 2 | Hodgdon burn rate chart | about 25 name-only powder records, plus the printed burn order | 2 | about 12 records | 1 PDF request, two-column list read | None found |
| 3 | Accurate data sheets | 9 powders, an estimated 500 to 900 rows with PSI | 3 | about 200 rows | 9 PDF requests at 10 seconds apart, layout text read, one table per cartridge as in the DP68 sheet | None found; read the PDFs' own terms |
| 4 | Shooters World manual (2023) | about 1,350 rows (670 load lines times start and maximum), PSI on the handgun tables | 6 | about 225 rows | 1 PDF request, layout text read, similar to the Lovex reader but a different layout | None stated |
| 5 | Barnes | 138 PDFs, an estimated 10,000 to 20,000 rows (extrapolated from 87 pairs in the 30-06 file), plus BC and SD per bullet | 12 | about 800 to 1,700 rows | 138 PDF requests at 10 seconds apart (23 minutes) after one index request, layout text read | No terms page found |
| 6 | Hammer | about 211 sheets, an estimated 10,000 lines, as start charge, start velocity and velocity at max | 10 | about 1,000 lines | 211 CSV export requests at 1 second apart after one index request | No terms; the maximum charge is not in the columns read |
| 7 | Somchem | an estimated 1,500 to 3,000 rows, 12 new powders, V/C factor | 8 | about 250 rows | About 64 calibers times 5 weapon types in HTML, at 10 seconds apart, table parse | The `/search/` robots line; the site shows an error banner |
| 8 | Nosler | an estimated 24,000 rows from about 1,000 one-page PDFs (about 125 cartridges times about 8 weights), plus BC, SD, COAL and case capacity | 14 | about 1,700 rows | About 1,000 PDF requests at 1 per second (17 minutes) after the index; one fixed layout, three charges per powder | Website use policy restricts reproduction |
| 9 | Sierra | 170 PDFs, charge per target velocity grid, no start or maximum, no pressure | 16 | unknown (a different row meaning) | 170 PDF requests; text read has to remove the watermark | Watermark "individual use only"; ask the maker first |
| 10 | Hornady free PDFs | Basic Rifle and Basic Pistol data, ECX, A-Tip: size unknown | 4 | unknown | A few PDF requests | Terms silent on reuse; the book and app data are paid |
| 11 | Lapua catalogue | about 60 bullet records and factory velocity points | 4 | about 15 records | 1 PDF request | Legal notice forbids duplication without consent: ask |
| 12 | Hodgdon Annual Manuals 2017 to 2024 | Older editions, no new cartridge expected | 6 | low | 8 PDF requests | Superseded; read only to find withdrawn rows |

Not worth reading now: the Hodgdon Reloading Data Center (forbidden), Berger load data (terms), Lehigh (nothing found), H&N (nothing found), Speer (a script-loaded page, not read; revisit once the other sources are in), the Vectan 2025 US catalogue (shotshell only), Western Powders (compromised).

Powder name-only coverage is cheaper than any row source: item 2 above covers the burn chart; the Vectan and Lovex catalogues are already sources of powder records.

## What this means for the ticket's other questions

- Coverage of cartridges with no pressure: only the five makers that print pressure help (Hodgdon, ADI, Western, Reload Swiss, Lovex, and the Accurate and Shooters World documents above). None of Barnes, Nosler, Hammer, Sierra or Somchem print pressure, so they add rows for velocity deviation, not for pressure.
- The new row sources mostly add rows to cartridges that already have rows (the common rifle cartridges). The coverage gap for the 336 stays unless a regional source is found for the European and Russian ones.
- Bullets: after item 1, the remaining bullet gaps by row count are Nosler, Barnes and Speer; each has a catalogue behind its own site whose terms were not all read.

## Owner decisions

1. May the project read Nosler (use policy restricts reproduction), Sierra (watermark, individual use), Berger (terms bar scraping) and Lapua (consent for duplication) from public pages with the maker as the cited source, or should each be asked for written permission first? The map says maker data goes public with the maker as `publisher` and the maker's terms in the record; these four terms conflict with that unless the maker agrees.
2. Hodgdon states its data center data is proprietary and bars automated scraping. Confirm that the Annual Manual PDF is the only Hodgdon route (it is already collected).
3. Somchem's robots.txt lists `/search/` but the data URLs are `/search?...`. Confirm that reading them is acceptable, or write to the maker.
4. The 16 SAAMI cartridge ids used by 3,054 rows have no cartridge records on `main`. Should they get cartridge records before the import, so those rows count against the 577?

## Sources

- `https://hodgdonreloading.com/` (footer terms), `https://hodgdonpowderco.com/reloading-manuals-library/`, `https://hodgdonpowderco.com/accurate/`
- `https://shootersworldpowder.com/`, `https://www.somchemreload.com/` and its `/disclaimer`
- `https://barnesbullets.com/load-data/`, `https://www.nosler.com/load-data/caliber-and-cartridge-data.html`, `https://www.nosler.com/website-use-policy`
- `https://hammerbullets.com/load-data/`, `https://sierrabullets.com/load-data/`
- `https://bergerbullets.com/reloading-data/`, `https://bergerbullets.com/terms-and-conditions/`, `https://bergerbullets.com/pdf/Quick-Reference-Sheets.pdf`
- `https://www.lapua.com/support/downloads_/`, `https://www.lapua.com/more/legal-notice/`
- `https://www.hornady.com/support/load-data/`, `https://www.hornady.com/terms-of-use`, `https://www.speer.com/reloading/rifle-data.html`
- robots.txt of each host above, plus `rws-ammunition.com`, `hn-sport.de`, `cuttingedgebullets.com`, `docs.google.com`
