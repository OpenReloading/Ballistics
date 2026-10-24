---
title: Federations, disciplines and target mappings
description: The records of shooting sport federations, the disciplines their rule books define and the target faces each discipline is shot on.
---

# Federations, disciplines and target mappings

Three record kinds describe who defines a discipline, what the discipline is and which target face scores it. Ring scoring starts from them: a federation, then a discipline, then the face (see [Ring scoring](../models/ring-scoring.md)).

- Every value is read from a rule book that the target face records already cite, with its section and page. A value the rule book does not state stays absent.
- Schemas: `packages/schema/src/federation.ts`.
- Records: `packages/data/records/federations/`, `disciplines/`, `target-mappings/` and `caliber-classes/`.

## Caliber class

`records/caliber-classes/<id>.json`, schema `caliberClass`: `id`, `name` (as a shooter says it), `diameter` (nominal bullet diameter, mm), `cartridges` (ids of the member cartridge records, empty where the class has no C.I.P. cartridge) and `provenance`. A class groups cartridges whose bullets have the same diameter, so a hole size separates .22, 9 mm and .45 and cannot separate classes of one diameter (9 mm Luger and .357 Magnum). `data:validate` (`src/caliber-classes.ts`) checks that every member is a cartridge record in one class only, that G1 of the cartridge side of its sheet lies within 0.15 mm of the class's diameter, and that every class id a discipline names is a record. The diameter is G1 of the sheet; .22 rimfire takes the calibre 5.6 mm of the rule books, since G1 of the .22 Long Rifle sheet equals the case diameter (heeled bullet), and the air class takes the calibre of the rule book. `GET /caliber-classes/:id` answers the record.

## Federation

`records/federations/<id>.json`, schema `federation`.

| Field | Meaning |
|---|---|
| `id` | Record id, the file name |
| `name` | Full name as the rule book prints it |
| `abbreviation` | Short name, the `organization` of the faces and face events ("ISSF", "DSB") |
| `country` | ISO 3166-1 alpha-2 code, or `international` for a world body |
| `internationalFederation` | Id of the international federation the rule book names this one a member of |
| `ruleBooks` | Ids of the source records of the rule books the records cite. The API returns title, edition, URL and SHA-256 |
| `provenance` | Sources with the page each value was read at |

## Discipline

`records/disciplines/<id>.json`, schema `discipline`. One record per discipline and distance of one federation: a discipline shot at 25, 50 and 100 m is three records.

| Field | Meaning |
|---|---|
| `federation` | Id of the federation whose rule book defines it |
| `name`, `number` | Name and discipline number or code as printed ("2113", "SG 1") |
| `section`, `page` | Rule-book section that defines it, printed page and PDF page |
| `distance` | mm |
| `category` | Kind of firearm (`disciplineCategory`), where the rule book states it |
| `caliberClasses` | `ids` of caliber class records (`records/caliber-classes/`) with `basis`: `stated` (the rule book names them) or `derived` (a stated range or bound expanded to the classes whose diameter lies in it) |
| `internationalDiscipline` | Id of the discipline of an international federation the rule book names as equivalent |

A discipline shot over several distances in one match (BDS Mehrdistanzschießen) is one record: `distance.value` is the farthest distance, `distance.raw` lists all of them. Its mapping holds the shots of the whole discipline.

Muzzle-loading disciplines carry no caliber classes: the classes group cartridges, and a bore given in inches is no cartridge.

## Target mapping

`records/target-mappings/<id>.json`, schema `targetMapping`. One record per face event:

- the discipline, the face and the face event that scores it
- where the rule book states them: the `stage` (a discipline with a precision and a rapid-fire part has one mapping per face), the scoring `gauge` and the number of record shots `shotCount` (sighters not counted)

A mapping gauge equals the event's where both are given. Which gauge scores a group: [Ring scoring](../models/ring-scoring.md).

The face record keeps its `events` (name, distance, gauge, scoring, organization, section, category). A face event has no caliber classes: a face file with `events[].caliber` is rejected.

The scoring rules of a face (`decimal`, `innerTen.rule`, `events[].scoring`) are set only where a cited rule book states them, with its page in the provenance. Absent means not stated: the face page shows "Not stated", and the app scores whole rings and counts the hole edge.

A face with `photoSearch: false` is skipped by the photo face search. The user picks it from the face list. Absent: the face search tries it.

## Validation

`npm run data:validate` (`packages/data/src/federations.ts`, `checkFederations`) reports:

- a discipline whose `federation` names no record
- an `internationalFederation` or `internationalDiscipline` link to a record that is not of an international federation, or to no record
- a mapping whose discipline, face or face event does not exist, whose event belongs to another organization than the discipline's federation, or whose gauge differs from the event's
- a second mapping of one face event
- a discipline no mapping names

The schemas reject any key they do not define, and `data:validate` an unknown caliber class id. Every data field of the three kinds is covered by a provenance source (`checkCoverage`). The records list `fields` on every source.

## API

Served under `/v1` (`packages/api/src/routes/federations.ts`). Each `/:id` route returns the record.

| Route | Items |
|---|---|
| `GET /federations` | `{ id, name, abbreviation, country, internationalFederation? }` |
| `GET /disciplines?federation=` | `{ id, federation, name, number?, distanceMm, category? }` |
| `GET /target-mappings?discipline=&face=` | `{ id, discipline, face, event, stage?, gaugeMm? }`, `gaugeMm` in mm |
| `GET /caliber-classes` | `{ id, name, diameterMm }`, by diameter |

Each list answers `{ total, items }` in the default order below. `GET /target-faces` lists per face the caliber classes of the disciplines mapped to it (`caliberClasses`) and the categories of its events and those disciplines (`categories`).

## Default order

One set of comparators (`packages/schema/src/competition-order.ts`) orders every list: the REST lists, the discipline and target face directories, the discipline table of a face page, the face table of a discipline page and the pickers of the group panel. The directories show the API's order until a column header is clicked, which sorts by that column instead.

| Entity | Order |
|---|---|
| Federation | Abbreviation |
| Discipline | Federation, then its own code (below), then distance, then name |
| Target face | Organization, then the code printed in the name (BDS `(Z2)` before `(Z18)`; faces with a code first), then name |
| Face event | Distance ascending, then name |
| Target mapping | Order of its discipline, then face id, then id |

Names are alphabetical with numbers in numeric order (25 before 100). The code of a discipline, per federation:

| Federation | Numbers | Order |
|---|---|---|
| BDS | `2101`, group codes `10xx`, `73xx` | By value, `x` read as `0`: `73xx` is 7300, after `4110` |
| DSB | Section and item, `1.10`, several codes joined by `/` | The first code, each dotted segment numeric: `1.9`, `1.10`, `1.37/1.51/1.54`, `2.20` |
| DSU, BDMP, VdRBw | Prefix and number, `LDG 2`, `G-H 6`, `SP3` | Prefix, then the number, then any text after it. Several codes by the first. Some BDMP and DSB records have no number |
| ISSF | None | By category (the order of `disciplineCategory`: air rifle, air pistol, rifle, pistol, ...), then distance, then name |

A discipline without a number follows the numbered ones of its federation and is ordered like ISSF.

## Ring scoring

The group panel of `/groups` (`apps/web/src/components/ring-scoring.tsx`, `apps/web/src/lib/face-disciplines.ts`) has these lists:

1. Federation: All, or one federation, by abbreviation.
2. Discipline: the disciplines of that federation in the default order. With All, every federation in turn, then the face events no mapping names by organization and name.
3. Face: the faces of the discipline's mappings with their stage, in the order of the stages, else every face by name. With only a federation chosen, the faces its disciplines map to and the faces it publishes.
4. Event: only for a face no mapping names, by distance ascending, then name.

The lists use the default order above (`apps/web/src/lib/face-order.ts` re-exports the comparators). The faces of one federation in the face list are in the order of target faces.

A group stores the face id and the face event name, so the discipline follows from its mapping when the sheet is opened again.

## Sources

Each rule book is one source record (`records/sources/<id>.json`: title, publisher, edition, URL, retrieval date and SHA-256). A record cites it by id with its own page, fields and note (`{ "source": "<id>", "page": "..." }`). The API returns the source resolved.

The records cite [BDMP 2026](../bibliography.md#bdmp-2026), [BDS 2025](../bibliography.md#bds-2025), [BDS 2026](../bibliography.md#bds-2026), [BDS 2026, Allgemeiner Teil](../bibliography.md#bds-2026-a) (touch rule, the Z20 black area), [DSB 2027](../bibliography.md#dsb-2027), [DSU 2018](../bibliography.md#dsu-2018), [ISSF 2025, Third Print](../bibliography.md#issf-2025-third), [ISSF 2022](../bibliography.md#issf-2022) (gauges) and [VdRBw](../bibliography.md#vdrbw). BDS disciplines take number, name, distance and face from the discipline list of the target volume (2025), and category, caliber classes and shots from the handgun and long-gun volumes (2026). The long-gun volume also gives the disciplines that the target volume does not list. Where the shots depend on the level of the match, a BDS mapping holds the number of the Deutsche Meisterschaft.

DSB rows without a record: a face needs rings and a black diameter, and a discipline needs a mapping to a face event. Scheibe Nr. 9 (flap target), Nr. 22 and Nr. 23 (hit areas) print no rings, so rows 2.16 and 8.11 to 8.25 have no discipline. Scheibe Nr. 14/15 prints no mirror diameter. Shotgun, muzzle-loader shotgun, crossbow, archery and Target Sprint rows are out of scope.
