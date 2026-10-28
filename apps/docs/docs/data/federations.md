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
| `abbreviation` | Short name ("ISSF", "DSB"), shown as the organization of a face and of a face event |
| `country` | ISO 3166-1 alpha-2 code, or `international` for a world body |
| `internationalFederation` | Id of the international federation the rule book names this one a member of |
| `website` | https URL of the federation's own homepage, checked by loading it: it answers and names the federation. Absent where no address was verified |
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
| `rules` | The rule facts below, each present only where the rule book states it |

### Rule facts

`rules` holds what a shooter needs to set up a match. Every field is optional and **absent means the rule book does not state it** for that discipline: the page shows nothing for it. Each field is cited in the provenance with its own source and page (`fields`: `rules.<name>`).

| Field | Meaning |
|---|---|
| `firearm` | `short-gun` or `long-gun` |
| `actions` | Actions allowed: `single-shot`, `repeater`, `semi-automatic`, `revolver`, `lever-action` |
| `positions` | Positions allowed: `standing`, `kneeling`, `sitting`, `prone` (a rule book that frees the position lists all four) |
| `supports` | How the firearm may be supported: `freehand`, `sling`, `rest` |
| `sights` | Sights allowed: `original` (as issued), `open`, `aperture`, `optical`, `reflex` |
| `maxMagnification` | Greatest magnification of an optical sight |
| `minTriggerWeight` | Least trigger weight at release, g |
| `maxBarrelLength` | mm |
| `maxFirearmMass` | g |
| `ammunition` | `handloads` (reloaded ammunition allowed or not), `minMuzzleEnergy` (J), `minBulletMass` and `maxBulletMass` (g), `bulletTypes` (`lead`, `jacketed`, `full-metal-jacket`, `hollow-point`, `wadcutter`) |
| `sighters` | Number of sighting shots, or `unlimited` where the rule book allows any number (a rule book that says none gives `0`) |
| `seriesShots` | Shots of one series, where the score is split into series |
| `timeLimits` | List of `duration` (s, with the printed figure in `raw`), what it `covers` (`discipline`, `stage`, `series`, `shot`) and `includesSighters` where stated |

A quantity is `{ value, raw? }` in its stored unit (time: s, see [Record model](record-model.md)). Power factors, which are no single stored quantity, are not recorded.

### Which facts the rule books state

Disciplines with the fact set, of the disciplines of each federation (stage values on target mappings are not counted; 58 mappings carry `sighters`, `seriesShots` or `timeLimits`):

| Fact | BDMP (110) | BDS (106) | DSB (47) | DSU (72) | ISSF (16) | VdRBw (25) |
|---|---|---|---|---|---|---|
| `firearm` | 103 | 104 | 44 | 72 | 16 | 25 |
| `actions` | 98 | 101 | 31 | 62 | 5 | 25 |
| `positions` | 103 | 104 | 38 | 71 | 16 | 25 |
| `supports` | 103 | 104 | 34 | 72 | 16 | 25 |
| `sights` | 100 | 101 | 41 | 71 | 10 | 25 |
| `maxMagnification` | 15 | 15 | 0 | 7 | 2 | 3 |
| `minTriggerWeight` | 61 | 79 | 13 | 0 | 8 | 20 |
| `maxBarrelLength` | 24 | 13 | 12 | 16 | 5 | 7 |
| `maxFirearmMass` | 33 | 87 | 15 | 0 | 15 | 0 |
| `ammunition.handloads` | 71 | 74 | 1 | 48 | 0 | 25 |
| `ammunition.bulletTypes` | 43 | 104 | 16 | 1 | 11 | 0 |
| `ammunition.minMuzzleEnergy` | 7 | 0 | 0 | 8 | 0 | 0 |
| `ammunition.minBulletMass` | 6 | 0 | 1 | 0 | 1 | 0 |
| `ammunition.maxBulletMass` | 7 | 0 | 0 | 0 | 0 | 0 |
| `sighters` | 75 | 95 | 28 | 27 | 14 | 21 |
| `seriesShots` | 36 | 96 | 5 | 42 | 8 | 21 |
| `timeLimits` | 58 | 72 | 27 | 62 | 11 | 15 |

A gap is a fact the rule books leave open, or a fact that one record cannot hold:

- **Open in all six rule books:** minimum muzzle energy, minimum and maximum bullet mass (stated only for the few disciplines counted above), and handload rules outside the disciplines counted. Limits written as a power factor, a momentum or a maximum energy have no stored quantity and are not recorded.
- **Barrel length:** stated for handgun disciplines; the rifle tables of the German rule books print the length of the whole system, which is no barrel length.
- **Free or as issued:** where a rule book says "any" or "as the original" for trigger weight, firearm mass or magnification, the field is absent.
- **Time limits:** a record merging rows with different times, or a discipline whose time differs per stage while it has a single unstaged mapping, has no `timeLimits`. Sighting-only windows are not recorded.
- **Other gaps:** BDS air gun disciplines (the cited BDS volumes hold no air gun rules), DSB Großkaliber 2.51 to 2.57 (no mass, trigger or sighters), BDMP Teil E (the part covers long and short guns) and records of DSB that merge rows of different rule tables (only facts that every merged row states are set).
- **Where the rule books differ by class or level of the match:** the record holds the value of the championship programme or the standard class and its note names the other (for example BDS Deutsche Meisterschaft, BDMP target rifle against F-class mass).

Choices that the enums force: a closed rear sight (Lochkimme) is `aperture`; "any sight" lists every sight; lying on a rest where freehand is also allowed lists both supports; resting on a post is `rest`. The note of a record says where it applies.

A discipline with stages whose sighters, series size or time limits differ puts `sighters`, `seriesShots` and `timeLimits` on the stage's [target mapping](#target-mapping) instead; a stage value replaces the discipline's. The record shots of a stage stay `shotCount` of the mapping.

A discipline shot over several distances in one match (BDS Mehrdistanzschießen) is one record: `distance.value` is the farthest distance, `distance.raw` lists all of them. Its mapping holds the shots of the whole discipline.

Muzzle-loading disciplines carry no caliber classes: the classes group cartridges, and a bore given in inches is no cartridge.

## Target mapping

`records/target-mappings/<id>.json`, schema `targetMapping`. One record per face event:

- the discipline, the face and the id of the face event that scores it
- where the rule book states them: the `stage` (a discipline with a precision and a rapid-fire part has one mapping per face; a discipline whose caliber groups shoot on different faces has one mapping per face with the groups as its `stage`), the scoring `gauge` the number of record shots `shotCount` (sighters not counted) and the stage's own `sighters`, `seriesShots` and `timeLimits` (as in [Rule facts](#rule-facts))

A mapping gauge equals the event's where both are given. Which gauge scores a group: [Ring scoring](../models/ring-scoring.md).

A face names its federation by `federation` (a federation record id). A face without one is a user's own design. The face record keeps its `events` (`id`, name, distance, gauge, scoring, `federation`, section, category). An event `id` is a record id, unique within the face. An event of another federation than the face's names that federation by id and cites its `section`. `GET /target-faces` items carry `federation` and, derived from it, the `organization` abbreviation. A face event has no caliber classes: a face file with `events[].caliber` is rejected.

The scoring rules of a face (`decimal`, `innerTen.rule`, `events[].scoring`) are set only where a cited rule book states them, with its page in the provenance. Absent means not stated: the face page shows "Not stated", and the app scores whole rings and counts the hole edge.

A ring is a circle (an oval where it has a `height`) unless its `shape` is `square` or `stadium`. A stadium has straight vertical sides and a half circle of half its width at each end, and a `height` of at least its width. A face has stadium rings on all rings or on none, and its inner ten and black area are stadiums too (the DSU oval-ring faces).

A face with `photoSearch: false` is skipped by the photo face search. The user picks it from the face list. Absent: the face search tries it.

## Validation

`npm run data:validate` (`packages/data/src/federations.ts`, `checkFederations`) reports:

- a discipline whose `federation` names no record
- an `internationalFederation` or `internationalDiscipline` link to a record that is not of an international federation, or to no record
- a mapping whose discipline, face or face event does not exist, whose event belongs to another federation than the discipline's, or whose gauge differs from the event's
- a second mapping of one face event
- a face without a federation, a face or face event whose `federation` names no record, and a face event id used twice in one face
- a discipline no mapping names

The schemas reject any key they do not define, and `data:validate` an unknown caliber class id. Every data field of the three kinds is covered by a provenance source (`checkCoverage`). The records list `fields` on every source.

## API

Served under `/v1` (`packages/api/src/routes/federations.ts`). Each `/:id` route returns the record.

| Route | Items |
|---|---|
| `GET /federations` | `{ id, name, abbreviation, country, internationalFederation?, website? }` |
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
2. Discipline: the disciplines of that federation in the default order. With All, every federation in turn, then the face events no mapping names by federation and name.
3. Face: the faces of the discipline's mappings with their stage, in the order of the stages, else every face by name. With only a federation chosen, the faces its disciplines map to and the faces it publishes.
4. Event: only for a face no mapping names, by distance ascending, then name.

The lists use the default order above (`apps/web/src/lib/face-order.ts` re-exports the comparators). The faces of one federation in the face list are in the order of target faces.

A group stores the face id and the face event id, so the discipline follows from its mapping when the sheet is opened again.

## Sources

Each rule book is one source record (`records/sources/<id>.json`: title, publisher, edition, URL, retrieval date and SHA-256). A record cites it by id with its own page, fields and note (`{ "source": "<id>", "page": "..." }`). The API returns the source resolved.

The records cite [BDMP 2026](../bibliography.md#bdmp-2026), [BDS 2025](../bibliography.md#bds-2025), [BDS 2026](../bibliography.md#bds-2026), [BDS 2026, Allgemeiner Teil](../bibliography.md#bds-2026-a) (touch rule, the Z20 black area), [DSB 2027](../bibliography.md#dsb-2027), [DSU 2018](../bibliography.md#dsu-2018), [ISSF 2025, Third Print](../bibliography.md#issf-2025-third), [ISSF 2022](../bibliography.md#issf-2022) (gauges) and [VdRBw](../bibliography.md#vdrbw). BDS disciplines take number, name, distance and face from the discipline list of the target volume (2025), and category, caliber classes and shots from the handgun and long-gun volumes (2026). The long-gun volume also gives the disciplines that the target volume does not list. Where the shots depend on the level of the match, a BDS mapping holds the number of the Deutsche Meisterschaft.

DSB rows without a record: a face needs rings and a black diameter, and a discipline needs a mapping to a face event. Scheibe Nr. 9 (flap target), Nr. 22 and Nr. 23 (hit areas) print no rings, so rows 2.16 and 8.11 to 8.25 have no discipline. Scheibe Nr. 14/15 prints no mirror diameter. Shotgun, muzzle-loader shotgun, crossbow, archery and Target Sprint rows are out of scope.
