---
title: Firearm records
description: Recommended record kinds for firearm manufacturers, models, variants and builds, where their data can come from, and the decisions the owner takes.
---

# Firearm records

A shooter picks a gun in the workbench and its barrel length, twist, chamber and mass come with it. This page recommends how to model that, lists the sources the data could come from with their terms, and ends with a decision brief. Nothing described here exists yet: no schema, importer or record is written, and no third-party data is in the repository.

Evidence marks: **[read]** the official page was fetched and read; **[summary]** only a summary or a search result was available, so the wording is unverified; **unverified** no official page was read. Quotes are at most 15 words. Legal remarks are readings of the cited texts, not legal advice. Results are simulations, not load data; a firearm record holds facts about the gun.

## Recommendation

Add two catalogue record kinds, `firearmModel` (the identity of a gun) and `firearmVariant` (one chambering and barrel of a model, self-contained, no inheritance). Reuse the `manufacturer` record. Keep builds as user records: the existing `firearm` record plus an optional parts list and an optional catalogue reference. The workbench Gun card copies a picked variant into the browser library.

No source found can be imported in bulk: every source with firearm models, barrel lengths and twist rates is restricted, all rights reserved, share-alike or too sparse (section [Data sources](#data-sources)). The data path is permission first, shipped with invented demo records until a maker grants permission. The choices are in the [decision brief](#decision-brief).

## What exists today

- A firearm is one schema, `firearm`, for every origin: lengths in mm, mass in g, angles in degrees, each as a `quantity` object, with the maker as a manufacturer reference (`catalogue:` or `user:`), and `model` (`packages/schema/src/firearm.ts`). Optics are children of it (`optic`). The optic as mounted carries the sight height and zero (`opticMount`, `opticConfiguration`). The browser keeps it as the user record `firearm` (`packages/schema/src/user-data.ts`).
- The workbench keeps the gun on the load: `Load.firearm` (`packages/schema/src/load.ts`) is an optional reference to such a user record, no copy.
- The Gun card is a picker over the browser library (`GunPicker` in `apps/web/src/components/workbench-inputs.tsx`). `chooseFirearm` copies twist and mass into the form (`apps/web/src/components/use-workbench-load.ts`). The barrel length reaches the seating preview through the record (`LoadFigure` in `workbench-inputs.tsx`) and the defaults (`suggestDefaults` in `apps/web/src/lib/input-defaults.ts`), not through the form.
- Catalogue records are one JSON file per record, the id equals the file name, ids are unique across roots (`checkRecordId` in `packages/data/src/read-kind.ts`). Every record has `provenance` (`packages/schema/src/provenance.ts`), whose sources (`source`) carry `origin` (`sourceOrigin`), `license`, `terms`, `page`, `retrieved` and `sha256`. A source cited by several records is stored once in `packages/data/records/sources/`. Kinds are read by `readRecords` in `packages/data/src/records.ts`. Stored units: length mm, mass g, angle deg, count 1 (`units` in `packages/schema/src/units.ts`).
- `manufacturer` has `id`, `name`, `website`, `aliases` and `provenance`, and is documented as a maker of powders or bullets (`packages/schema/src/manufacturer.ts`, [Manufacturers](manufacturers.md)). Powder and bullet records reference it by id. Demo records use an invented name and a source of `synthetic-test-data`.
- No field of `packages/core/src` or `packages/schema/src` mentions a gas port or gas system (search for `gas port`, `gasPort`, `gas system`). It has no effect on any computed quantity.
- Sight height lives on the optic mount, not on the gun. A catalogue gun cannot supply it unless the record includes optic and mount.
- `freebore`, `baseToOgiveAtLands` and `overallLengthAtLands` of the user firearm (`firearm.ts`) are measured values of one barrel. The two lands lengths need `landsBullet`, the reference to the bullet they were measured with; the workbench uses them for the jump only with that bullet. No source of the table below was seen to print them, so the catalogue does not carry them.

## Recommended schema

Catalogue records are `packages/data/records/<kind>/<id>.json`, stored units mm, g, deg, count, each with `provenance`. `quantity(kind)` means `{ value, raw? }` in the stored unit, as in `packages/schema/src/load.ts`.

| Kind | Field | Type, unit | Notes |
|---|---|---|---|
| `manufacturer` (existing, extended) | `country` | ISO 3166-1 alpha-2, optional | needs a source with `fields: ["country"]`, as `needsCountrySource` (`packages/schema/src/shared.ts`) requires for powders and bullets; the doc comment "makes powders or bullets" is widened |
| | other fields | unchanged | one record serves powder, bullet and firearm makers; a renamed maker keeps its id and the old name goes to `aliases` |
| `firearmModel` | `id` | record id | `<manufacturer-id>-<model-slug>`; never changes |
| | `manufacturer` | id of a `manufacturer` | required |
| | `name` | text | as the maker prints it |
| | `aliases` | text[] | regional and former names of the same gun; searched, unique per manufacturer |
| | `category` | enum: rifle, carbine, pistol, revolver, shotgun, combination, other | for filters |
| | `action` | enum: bolt, semi-auto, lever, pump, single-shot, break, revolver, other; optional | |
| | `country` | ISO 3166-1 alpha-2, optional | country of manufacture; needs a source with `fields: ["country"]` |
| | `production` | `{ from?, to? }` years, count 1 | `to` absent: in production when the source was retrieved |
| | `successor` | id of a `firearmModel`, optional | a discontinued model points to its replacement |
| | `provenance` | provenance | |
| `firearmVariant` | `id` | record id | `<model-id>-<designation-slug>` |
| | `model` | id of a `firearmModel` | required |
| | `designation` | text, optional | the maker's catalogue name or item number as printed |
| | `chamber.name` | text | chambering as printed; always stored |
| | `chamber.cartridge` | id of a `cartridge`, optional | set only when the printed name resolves to a record; the repository holds C.I.P. cartridges only, so many chamberings stay unresolved |
| | `barrel.length` | quantity length, mm | `barrel.measuredFrom`: enum boltFace, breech, unstated (makers differ on where the length starts) |
| | `barrel.twist` | quantity length, mm per turn | 1:7 in is 177.8 mm; matches the user record's length per turn |
| | `barrel.twistHand` | enum right, left | |
| | `barrel.grooves` | count 1, optional | |
| | `barrel.grooveDiameter`, `barrel.boreDiameter` | quantity length, mm, optional | rarely published; the cartridge sheet gives the nominal values |
| | `mass` | quantity mass, g, optional | `massBasis` text (empty, without magazine or optic) |
| | `overallLength` | quantity length, mm, optional | |
| | `sightRadius` | quantity length, mm, optional | iron sights, printed for pistols |
| | `verification` | enum verified, unverified | every value checked by hand against the cited page, as `cartridge.verification` (`packages/schema/src/cartridge.ts`) |
| | `provenance` | provenance | page citation, `retrieved`, `sha256`, `origin`, `license` or `terms` |
| `firearmBarrel` (phase 2) | `id`, `manufacturer`, `name`, `chamber` | as variant | an aftermarket barrel is a catalogue part; the only part that carries ballistic data |
| | `length`, `twist`, `twistHand`, `grooves`, diameters | as variant `barrel` | plus `profile` text, `mass` g |

User records (browser and files) use the same shape and stored units as catalogue records (`packages/schema/src/firearm.ts`, [Record model](record-model.md) step 5). Changes to `firearm`:

| Field | Type, unit | Notes |
|---|---|---|
| `catalogue` | `{ variant: id, retrieved: date }`, optional | where the values were copied from; nothing reads it back |
| `parts` | array of `{ kind, name, manufacturer?, mass? }`, at most 20, optional | `kind`: receiver, barrel, gasSystem, handguard, stock, muzzleDevice, other; `mass` a quantity in g; descriptive, no solver reads it |
| `barrelLength`, `twist`, `twistHand`, `grooveDiameter`, `boreDiameter`, `firearmMass`, `cartridge`, optics | unchanged | these stay the only values the solvers read; the solvers get them in SI |

Properties that matter for ballistics: barrel length, twist and hand, chamber (through the cartridge), bore and groove diameter where known, mass (recoil), sight height (optic mount, typed by the user). The gas system length matters for nothing the app computes, so it is a descriptive part, not a number. Receiver, handguard and stock are descriptive text.

Rules:

- Ids are slugs and never change. A renamed maker or model keeps its id, the old name goes to `aliases`.
- A model sold under different names in different regions is one model with the names as aliases.
- A variant has one chamber: a model made in three calibers has three variants. A variant offered in two barrel lengths has two variants.
- A discontinued model keeps its record with `production.to` set.
- New kinds are added to the `Bundle` and the reader of `packages/data/src/records.ts` and checked in `packages/data/src/references.ts`.

## Rejected alternatives

| Alternative | Why not |
|---|---|
| Variant inherits fields from its model and overrides some | The API, the web app, the validator and the importer would each need a merge step; a partial record cannot be validated alone; a source cites a value for one variant, not for the model. Repeating a value in three variants is cheaper than resolving inheritance. |
| Variants nested as an array in the model file | One record per file is the convention (`checkRecordId` in `packages/data/src/read-kind.ts`); nested variants cannot carry their own provenance and ids, make files large and a re-import diff noisy. |
| One flat record per model (chamber and barrel as fields) | Cannot list several calibers or barrel lengths of one model without repeating its identity; the model page and aliases would repeat. |
| New `firearmManufacturer` kind | Duplicates names and ids; a company that makes bullets and rifles would have two records; reference check, search and API for `manufacturer` already exist. |
| Every part of a build (receiver, handguard, stock, gas system) as a catalogue record | Only the barrel carries ballistic data; the other parts would be records no solver reads, with far more sources to clear and keep current. They stay descriptive fields of the user's build. A barrel record is a phase 2 option. |
| A build as its own record kind next to `firearm` | The `firearm` user record already holds barrel, twist, optics and configurations, and `Load.firearm` is tied to it. A second kind would double the picker, the file format and the editor. |
| Compute the sight height from receiver, mount and optic heights | The bore axis height over the rail is unverified for most receivers, so the sum would carry unknown offsets. Sight height stays a measured input of the optic mount. |
| A live reference from the workbench to the catalogue id | A saved workbench file would dangle when a record is removed or unavailable offline. A copy into the user record keeps files self-contained. |
| Chamber only as a cartridge id | Many chamberings have no cartridge record; a required id would drop those guns. The printed name is stored, the id is optional. |

## Data sources

For each source: what it offers, its terms, whether records can be imported, how many, and the attribution. "Not used" means the terms forbid automated collection or no licence exists, and nothing is collected there. The rows are about a site's terms, not the legal status of a bare fact. Facts are not protected by copyright in the US ([copyright office FAQ](https://www.copyright.gov/help/faq/faq-protect.html); [Feist](https://www.law.cornell.edu/supremecourt/text/499/340) [summary]), while the EU database right protects the extraction of a substantial part of a database whatever its contents ([Directive 96/9/EC](https://eur-lex.europa.eu/eli/dir/1996/9/2019-06-06) [summary]).

| # | Source (publisher) | Offers | Licence or terms | Records and count | Verdict and reason |
|---|---|---|---|---|---|
| 1 | Structured open knowledge base (Wikidata) | Items with properties, SPARQL, dumps | CC0, [licensing](https://www.wikidata.org/wiki/Wikidata:Licensing) [read]; [query limits](https://www.mediawiki.org/wiki/Wikidata_Query_Service/User_Manual) [read] | 670 items of class firearm model (a [count query](https://query.wikidata.org/sparql?format=json&query=SELECT%20(COUNT(*)%20AS%20%3Fc)%20WHERE%20%7B%3Fi%20wdt%3AP31%20wd%3AQ22704163%7D) returned 670 on 2026-10-24); 402 with ammunition, 55 with caliber, 109 with a length (unclear which); no property for barrel length or rifling twist found [read] | Usable for model names and chambering only; too sparse for barrel and twist. Seeds the names of the `firearmModel` list; each still needs a maker source for values. No attribution required. |
| 2 | Online encyclopedia infoboxes (Wikipedia) | Article text, infobox values | CC BY-SA 4.0, [copyrights](https://en.wikipedia.org/wiki/Wikipedia:Copyrights) [read]; crawling discouraged, use [dumps](https://en.wikipedia.org/wiki/Wikipedia:Database_download) [read] | Many, unstructured, inconsistent units | Usable for a single fact with a citation only: no prose, no table copy, no crawl. A systematic copy would be share-alike. Not recommended as a base. |
| 3 | Linked-data extract of the encyclopedia (DBpedia) | RDF, SPARQL | CC BY-SA 3.0 and GFDL, [about](https://www.dbpedia.org/about/) [read] | not counted | Not usable: share-alike derivative of source 2. |
| 4 | US Bureau of Alcohol, Tobacco, Firearms and Explosives lists and reports | Licensee list (name, address), annual manufacturing and export reports (counts) | Federal works carry no US copyright, [17 U.S.C. 105](https://www.law.cornell.edu/uscode/text/17/105) [read]; not everything on a federal site is a federal work, [usa.gov](https://www.usa.gov/government-copyright) [read]; site terms: page blocked, unverified | No model, barrel or twist; manufacturer names and yearly counts only | Usable for the manufacturer name list (business names only); no spec value. The licensee list holds addresses of individuals, not assessed. |
| 5 | Canada, Royal Canadian Mounted Police Firearms Reference Table | PDF of about 231 MB; searchable tool for authorised users | Non-commercial copying with credit; commercial redistribution needs written permission, [terms](https://rcmp.ca/en/terms-and-conditions) [read]; no open licence listing found in one portal query | Over 211,000 records [summary]; fields not documented on the page | Usable with permission only: an open repository redistributes. Possibly the largest public make, model, calibre and barrel list; ask first (contact on the terms page). |
| 6 | Australia, National Firearms Identification Database (Australian Criminal Intelligence Commission) | Web application: make, model, chambering, magazine capacity | Site copyright CC BY 4.0 Australia with exceptions, [copyright](https://www.acic.gov.au/copyright) [summary]; database terms unverified | not stated | Usable with permission: ask whether the database falls under the open licence. Barrel length not confirmed. |
| 7 | International police firearm reference table (Interpol) | Restricted web tool | Authorised users in member countries, [page](https://www.interpol.int/en/Crimes/Firearms-trafficking/INTERPOL-Firearms-Reference-Table) [read] | Over 165,000 references | Not usable: law-enforcement access only. |
| 8 | US military technical and field manuals (Army Publishing Directorate, defense technical library) | PDF manuals of service rifles and carbines | Federal employee works are not protected in the US, [notice](https://discover.dtic.mil/privacy-security-copyright/) [read]; contractor material and distribution statements vary | A few dozen service weapons; barrel and twist in some | Usable per document after reading its distribution statement and copyright line. Few guns, but a clean public-domain base for service arms. Outside the US unverified. |
| 9 | Non-profit research institute on small arms (Small Arms Survey) | Identification sheets (PDF), reports | "Please contact us to request permission before reproducing any material," [terms](http://www.smallarmssurvey.org/terms-of-use) [read] | Visual sheets, no structured specs | Not usable without permission; no value gained. |
| 10 | Open-data portal listings of firearm datasets (Kaggle) | CSV uploads by users | Licence per listing; the listings read did not render, [terms](https://www.kaggle.com/terms) unread | unverified | Not usable: the uploader's licence label cannot remove the terms of the origin of the data; take data from the origin. |
| 11 | German federal metrology institute, type approval list under the proof law | PDF list of approved devices | "Vervielfältigung nur zum eigenen persönlichen Gebrauch" in the [repository record](https://oar.ptb.de/resources/show/10.7795/520.2026070208) [summary] | Blank-firing, irritant and signal weapons only | Not usable: scope does not include rifles and the record limits reproduction. |
| 12 | US patent documents (USPTO) | Patent text and drawings | Generally not under copyright with limited exceptions, [terms](https://www.uspto.gov/terms-use-uspto-websites) [read] | Occasional barrel length, no catalogue | Usable for single facts with a citation; not a source of catalogue records. |
| 13 | Cartridge and chamber dimension tables (C.I.P.) | Per-cartridge PDF sheets | No terms page; footer "All rights reserved", [site](https://www.cip-bobp.org/en) [read]; [contact](https://www.cip-bobp.org/en/contact) | Cartridge and chamber dimensions, no firearm models | Already the source of the repository's cartridge records; supplies the chamber link of a variant, not firearms. |
| 14 | US ammunition and firearm standards body (SAAMI) | Standards, chamber drawings | "exclusive property of SAAMI," [terms](https://saami.org/terms-of-use/) [read]; no scraping clause; robots allow all, [robots.txt](https://saami.org/robots.txt) [read] | Cartridge and chamber drawings, no firearm models | Not usable without written permission: the terms give no licence. |
| 15 | International and NATO standards (ISO, ANSI, NATO standardization agreements) | Paid or restricted standards | ISO content copyrighted, [copyright](https://www.iso.org/copyright.html) [summary]; NATO public database lists unrestricted documents only, [catalogue](https://nso.nato.int/nso/nsdd/main/standards) unverified | No firearm models, no public chamber drawing found | Not usable: no relevant public content found. |
| 16 | Auction marketplace for firearms | Listings and a programming interface | User agreement reported to forbid spiders, robots and screen scraping (unverified), [agreement](https://support.gunbroker.com/hc/en-us/articles/37115383662491-Current-User-Agreement) [summary] | n/a | Not used: terms reported to forbid automated collection. |
| 17 | Two online retail catalogues for firearm parts | Product pages with specs | Terms pages returned an access error and were not read: [one](https://www.brownells.com/help/technical-support/terms-of-use/), [two](https://www.guns.com/terms-and-conditions) | n/a | Not used: terms not read (access error). |
| 18 | Rifle, carbine and pistol makers' websites and spec sheets (table below) | Specification pages, some PDFs | per maker, table below | Typically barrel length, caliber, mass, overall length; twist on some | Usable with permission; by hand with a page citation only where the terms place no limit (owner decision per maker). Automated collection: not used. |
| 19 | Product data exchange standards and feeds (GS1 data network, auto-parts ACES and PIES) | Licensed product data | GS1: source party owns the data, [terms](https://www.gs1.org/docs/gdsn/support/GDSN_Terms_of_Participation_non_US.pdf) [summary]; ACES and PIES: paid licence for internal business use, [terms](https://autocare.org/docs/default-source/data-standards/technology-license-agreement_02282025.pdf) [summary] | no firearm maker feed found | Usable with permission only, and only if a maker offers a feed; none found. |

Eight maker sites were read for terms and robots rules and are kept as keys M1 to M8; the names and quoted clauses are not published here. One product page was opened on some sites only to see which fields are printed; no values were taken.

| Key | Role | What the terms say | Verdict |
|---|---|---|---|
| M1 | US bolt-action rifle maker | Bans any robot, spider or automatic device for retrieval, indexing, data mining or scraping unless written permission is given [summary]; no robots.txt | Not used: terms forbid automated collection. |
| M2 | European bolt-action rifle maker | No site terms found, sales terms only; robots.txt allows product paths; spec data is in a caliber overview PDF that was not opened (unverified) | Usable with permission; a hand citation is possible, but no terms are stated (unverified). |
| M3 | Canadian rifle and chassis maker | Copyright line only; the product page prints caliber, barrel length, twist and mass | Usable with permission; a hand citation is possible, but no terms are stated (unverified). |
| M4 | US AR-pattern carbine maker | Materials copyrighted, no copying or publishing without written permission [summary]; the product page prints no spec fields | Usable with permission; little to take. |
| M5 | US AR-pattern carbine and upper maker | Collective work; copy for own non-commercial use [summary]; robots.txt rate limits named crawlers | Usable with permission. |
| M6 | Handgun maker | Download for personal non-commercial use, anything else needs written permission; no explicit scraping ban [summary]; the page prints barrel length and sight radius, no twist | Usable with permission. |
| M7 | Aftermarket barrel maker | Personal transitory viewing, no mirroring [summary]; the table prints barrel length and twist | Usable with permission. |
| M8 | Riflescope maker | Content and compilation are the owner's property, no commercial copying or reposting [summary]; no sight height printed | Usable with permission. |

No source gives a licence for firearm specifications. The only bulk and legal bases are US federal works (few guns, source 8), CC0 (names and chambering, source 1) and permission. Evidence limits: the fetch tool returned page summaries, several sites answered 403 to it, and the reading of the makers' terms is unverified as wording. The legal status of the German and EU rows needs counsel before any bulk use.

## Import path

- Shape: a pure parser in `packages/importers` (no I/O, no Node imports, as `packages/importers/AGENTS.md` requires), `parseFirearmSpecs(text, options)`. Input is a delimited text file in an OpenReloading template, one row per variant: manufacturer, model, designation, chamber as printed, barrel length with unit, twist as `1:7`, `1 in 7` or `178 mm`, mass with unit, source page. Output is `FirearmVariantCandidate[]`. Like the chronograph parsers it returns `{ candidates, missingPaths, warnings }`; the caller reads the file and computes the `sha256`.
- Who produces the file: a person who transcribes values from a cited page, or a maker who supplies a file under a permission. A second small parser can read a saved query result of source 1 for names and chamberings. No parser reads a website.
- Mapping: units to mm, g, deg (inch and mm accepted, any other unit rejected); twist forms to length per turn; the chamber name is matched to `cartridge` names and aliases after normalizing case, spaces and the `.` prefix, and an unmatched one stays `chamber.name` with a warning; the manufacturer is matched to `manufacturer` names or aliases, an unknown one is reported, not created.
- Validation: schema validation of each candidate; plausibility bounds (barrel length 20 to 1500 mm, twist 100 to 1000 mm per turn, mass 0.1 to 20000 g) as warnings, labelled as assumptions; duplicate ids within the file and against existing records.
- Re-import review: a maintainer script outside the package matches by id and writes a report: created, changed (field by field, old value to new value), unchanged, unresolved chamber names. It never overwrites a record. Changed values go into a pull request as a diff, `data:validate` runs on it, and a record with `verification: verified` changes only by a hand edit. The `retrieved` date and `sha256` of the cited file make the diff attributable.

## Workbench integration

- Pick a catalogue gun: the Gun card gets a search over variants next to the library select, built like the powder search (`RecordSearch` in `apps/web/src/components/record-search.tsx`), listing manufacturer, model, designation and chamber. When a cartridge is chosen the list is filtered to variants whose `chamber.cartridge` equals it, and a variant with another chamber shows a warning.
- Pick a variant: choosing a model shows its variants (barrel length, twist, chamber) in one select.
- Copy, not link: "Use" creates a user `firearm` record in the browser library (name, manufacturer name, model, cartridge, `barrelLength`, `twist`, `twistHand`, `grooveDiameter`, `boreDiameter`, `firearmMass`, `catalogue`) and sets `Load.firearm` to its id (`packages/schema/src/load.ts`, unchanged). The existing `chooseFirearm` then runs (`use-workbench-load.ts`). It must also copy the barrel length to the form: today it reaches the figure only through the record. Files stay self-contained. The static site reads data files the API writes at build time (`writeStaticApi` in `packages/api/src/static.ts`), so the static output must include the model and variant lists for the search to have data there.
- Build: the firearm editor gets a "Build" section with the parts list. Choosing or typing the barrel fills barrel length, twist and chamber. Optics and mounts stay as they are, and the sight height stays a typed value of the optic mount.
- The user's own firearms stay unchanged and listed first. A record without `catalogue` and `parts` behaves as now. No migration (pre-1.0).
- API and data: `GET /v1/firearm-models` and `/v1/firearm-variants` filtered by `q`, `manufacturer` and `cartridge`, like the powder list ([Manufacturers](manufacturers.md), section API). A new model page in `apps/docs/docs/data/` documents the kinds once they exist.

## Follow-up issues

Proposed, in order, each with acceptance criteria a test can check.

1. **schema: firearm model and variant records.** Add `firearmModel`, `firearmVariant`, `manufacturer.country`. Accept: a valid example of each parses; `chamber.cartridge` is optional; twist and length are stored in mm, mass in g, years as counts; a variant without `model` is rejected; `verification` is required; the JSON Schema is written; `npm run docs:check` passes for the exports.
2. **data: read and validate the new kinds.** Accept: `readRecords` reads `firearm-models` and `firearm-variants` folders; `data:validate` fails for a variant naming no model, a model naming no manufacturer, a `chamber.cartridge` naming no cartridge, a duplicate alias per manufacturer and a duplicate designation per model; demo records with invented names validate.
3. **api: list and get endpoints.** Accept: `GET /v1/firearm-models` and `/v1/firearm-variants` with `q`, `manufacturer`, `cartridge`, paging, and `GET .../:id`; `npm run api:check` passes with the baseline rewritten in the same pull request; a test fixes the search order; the static API output (`writeStaticApi`) includes both lists.
4. **importers: variant spec table parser.** Accept: tests for twist forms (`1:7`, `1 in 7`, `178 mm`), inch and mm lengths, the unmatched chamber warning, an unknown manufacturer reported, bounds warnings and duplicate ids; no Node imports in `src/`.
5. **tools: re-import report.** Accept: a script reads a file and the records root and writes created, changed and unchanged counts and a field diff; it never writes over an existing record; tested with fixtures.
6. **web: catalogue pick in the Gun card.** Accept: a Vitest of the copy mapping (every field and unit); a picked variant creates a library record and sets `Load.firearm`; the barrel length reaches the form; a chamber mismatch shows the warning; the search works in the browser (static lists); an e2e assertion only if a stack is needed.
7. **schema and web: build parts of the user firearm.** Accept: `parts` and `catalogue` are optional on `firearm`; an old file without them still loads; a part kind outside the enum is rejected; the editor adds, edits and removes parts; the data card prints them.
8. **docs: firearm records model page and source terms.** Accept: a new firearms page in `apps/docs/docs/data/` holds the record tables and the terms rules; docs checks and tests pass.
9. **owner task: permissions and first records.** Send written requests to makers and to the RCMP and ACIC (sources 5, 6, 18), name the fields wanted and the repository licence. Accept: each grant is recorded in its source record (`origin`, `license` or `terms`); records enter only for a granting maker.
10. **phase 2, optional: barrel records.** `firearmBarrel` kind and a barrel picker in the build; accept as issues 1 to 3 for barrels.

## Decision brief

**Question 1, scope of the first release.** Recommended: **B**.

- **A. Names only.** Keep the user firearm as it is; offer the manufacturer list in the editor as a suggestion. Smallest; the shooter still types barrel length and twist.
- **B. Models and variants, build as a user record (recommended).** The schema of this page without barrel records, copy into the library, parts list on the user firearm. Delivers barrel length, twist, chamber and mass with the gun; later steps follow without breaking files.
- **C. B plus barrel, receiver, handguard, stock and optic as catalogue records.** Far more sources to clear and maintain; only the barrel carries ballistic data.
- **D. Seed from a bulk source first.** Not available under the terms found.

**Question 2, where the first records come from.** Recommended: **E**.

- **E. Invented demo records in the repository, real records only per written maker or authority permission (recommended).** Consistent with the source rules and `origin: manufacturer`; slowest; no terms risk.
- **F. E plus single facts transcribed by hand with a page citation** from makers whose terms state no restriction (source 18: M2 and M3) and from public-domain manuals (source 8). Faster start; the owner decides per maker; the legal status of a fact is US-based, the EU database right is unresolved.
- **G. F plus names and chamberings from the open knowledge base (source 1).** Adds 670 model names; values still need E or F; no attribution required.

With B and E chosen, follow-up issues 1 to 8 can start; issue 9 is the owner's.

## Not verified

Wording of every `[summary]` and `unverified` row; the C.I.P. and SAAMI terms beyond their footers; the ATF terms page (blocked); the RCMP table's fields and count; the NFID terms; the two retailers' terms; the caliber overview PDF of M2; the meaning of the Wikidata caliber and length properties and whether other classes of gun items exist beyond the class firearm model; whether the EU database right applies to a maker site; bore axis heights of receivers.
