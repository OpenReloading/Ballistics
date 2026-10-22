---
title: Federations, disciplines and target mappings
description: The records of shooting sport federations, the disciplines their rule books define and the target faces each discipline is shot on.
---

# Federations, disciplines and target mappings

Three record kinds describe who defines a discipline, what the discipline is and which target face scores it. Ring scoring starts from them: a federation, then a discipline, then the face (see [Ring scoring](../models/ring-scoring.md)).

- Every value is read from a rule book that the target face records already cite, with its section and page. A value the rule book does not state stays absent.
- Schemas: `packages/schema/src/federation.ts`.
- Records: `packages/data/records/federations/`, `disciplines/` and `target-mappings/`.

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
| `caliberClasses` | `ids` of caliber classes of `caliberClasses` with `basis`: `stated` (the rule book names them) or `derived` (a stated range or bound expanded to the classes whose diameter lies in it) |
| `internationalDiscipline` | Id of the discipline of an international federation the rule book names as equivalent |

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

The schemas reject an unknown caliber class id and any key they do not define. Every data field of the three kinds is covered by a provenance source (`checkCoverage`). The records list `fields` on every source.

## API

Served under `/v1` (`packages/api/src/routes/federations.ts`). Each `/:id` route returns the record.

| Route | Items |
|---|---|
| `GET /federations` | `{ id, name, abbreviation, country, internationalFederation? }` |
| `GET /disciplines?federation=` | `{ id, federation, name, number?, distanceMm, category? }` |
| `GET /target-mappings?discipline=&face=` | `{ id, discipline, face, event, stage?, gaugeMm? }`, `gaugeMm` in mm |

Each list answers `{ total, items }`. `GET /target-faces` lists per face the caliber classes of the disciplines mapped to it (`caliberClasses`) and the categories of its events and those disciplines (`categories`).

## Ring scoring

The group panel of `/groups` (`apps/web/src/components/ring-scoring.tsx`, `apps/web/src/lib/face-disciplines.ts`) has these lists:

1. Federation: All, or one federation.
2. Discipline: the disciplines of that federation. With All, every discipline and then the face events no mapping names.
3. Face: the faces of the discipline's mappings with their stage, else every face.
4. Event: only for a face no mapping names.

A group stores the face id and the face event name, so the discipline follows from its mapping when the sheet is opened again.

## Sources

Each rule book is one source record (`records/sources/<id>.json`: title, publisher, edition, URL, retrieval date and SHA-256). A record cites it by id with its own page, fields and note (`{ "source": "<id>", "page": "..." }`). The API returns the source resolved.

The records cite [BDMP 2026](../bibliography.md#bdmp-2026), [BDS 2025](../bibliography.md#bds-2025), [BDS 2026](../bibliography.md#bds-2026), [BDS 2026, Allgemeiner Teil](../bibliography.md#bds-2026-a) (touch rule, the Z20 black area), [DSB 2026](../bibliography.md#dsb-2026), [DSU 2018](../bibliography.md#dsu-2018), [ISSF 2025, Third Print](../bibliography.md#issf-2025-third), [ISSF 2022](../bibliography.md#issf-2022) (gauges) and [VdRBw](../bibliography.md#vdrbw). BDS disciplines take number, name, distance and face from the discipline list of the target volume (2025), and category, caliber classes and shots from the handgun and long-gun volumes (2026). The long-gun volume also gives the disciplines that the target volume does not list. Where the shots depend on the level of the match, a BDS mapping holds the number of the Deutsche Meisterschaft.
