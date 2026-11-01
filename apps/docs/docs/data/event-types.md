---
title: Event types
description: The records of competition event types, their rule books, scoring rules and levels.
---

# Event types

An event type is a kind of competition event of one federation as its rule book defines it: IPSC Handgun, USPSA Handgun and PCC, a DSB championship. It holds what scoring and stage checks need: the scoring method with its points and penalties, the power factor floors, the level names, the magazine limits and whether moving targets are allowed. A person's own event and scores (the event user record) build on it; a score recorded by the person is never an official result.

- Every fact is read from the current edition of the federation's own rule book and cited with its section and page (`fields` in the provenance). The rule is described in our own words; no rule book text is copied, and the rule books are not in the repository. A fact taken from anything but the rule book would be marked unverified in its source note; the records hold none.
- Schema: `packages/schema/src/event-type.ts` (JSON Schema `event-type.schema.json`).
- Records: `packages/data/records/event-types/`, with the federations in `federations/` and the rule books as source records in `sources/`.

## Event type

`records/event-types/<id>.json`, schema `eventType`.

| Field | Meaning |
|---|---|
| `id`, `name` | Record id, the file name, and the name of the event type |
| `federation` | Id of the federation record whose rule book defines it |
| `ruleBook` | Id of the source record of the rule book; reading resolves it to `title`, `edition`, `publisher`, `url` and `sha256`. It must be one of the federation's `ruleBooks` |
| `scoring` | How the event scores, by `method` (below) |
| `levels` | Level names as the rule book prints them, lowest first |
| `magazine` | Magazine limits per division (below); absent: none recorded |
| `movingTargets` | `true` or `false` as the rule book states it; absent: it does not say |
| `provenance` | Sources with the section and page of each field |

### Hit-factor scoring

`method: hit-factor` (IPSC, USPSA). The points of the best hits on each target, less the penalties, divided by the stage time, give the hit factor; the best hit factor of a stage earns the stage's points, the others in proportion.

| Field | Meaning |
|---|---|
| `points` | Points of one hit, for each power factor (`major`, `minor`) and zone: paper `A`, `C`, `D`, and `metal` for a scoring popper or plate |
| `penalties` | Points taken off for each `miss`, each penalized `noShoot` hit and each `procedural` penalty |
| `noShootMaxHits` | Most hits penalized on one no-shoot; absent: the rule book sets no limit |
| `powerFactors` | Per `division` (as the rule book names it) the least power factor for `minor`, and for `major` where the division has a major rating |

### Ring scoring

`method: rings` (DSB and ISSF style). Each shot scores its ring, summed per series and for the event; the ring values come from the target face of the discipline ([Federations](federations.md), [Ring scoring](../models/ring-scoring.md)).

| Field | Meaning |
|---|---|
| `discipline` | Id of the one discipline the event type is shot in; absent: the event names its discipline |
| `seriesShots` | Shots of one series; absent: the discipline's `rules.seriesShots` |

### Magazine limit

One entry of `magazine`: `division`, `powerFactor` where the limit holds for one power factor only, `maxRounds` (rounds in a magazine at the start signal), `maxLength` (mm, the printed figure in `raw`) and a `note` for a condition such as a longer limit for single stack handguns. An entry has `maxRounds`, `maxLength` or both. A division whose rule limits the handgun with its magazine by a gauge box, or the rounds fired before a reload, has no entry; the source note says so.

## Checks

`npm run data:validate` (`packages/data/src/event-types.ts`) checks that

- the federation is a record and lists the event type's rule book,
- a ring scoring's `discipline` is a discipline of that federation,
- no division appears twice among the power factors and every magazine limit names a division with a power factor,
- every field is covered by a cited source (as for every catalogue kind).

## Records

| Event type | Rule book | Levels |
|---|---|---|
| `ipsc-handgun` | IPSC Handgun Competition Rules, January 2026 Edition | Level I to Level V (Appendix A1) |
| `uspsa-handgun` | USPSA Competition Rules, Edition 2026-09 (online rule book) | Level I, II, III, Nationals (Appendix A1) |
| `dsb-meisterschaft` | Sportordnung des DSB, Stand 01.01.2027 | Kreis-/Gau-, Bezirks-/Gau-, Landes-, Deutsche Meisterschaft (0.9.3.3) |

- **IPSC.** The PDF was downloaded from the IPSC Store, which the IPSC website links as its official store; the rule book pages of ipsc.org refused the download client. Standard Division has no magazine entry (gauge box), Revolver none (no cylinder limit).
- **USPSA.** USPSA publishes the edition as web pages. The source record holds the SHA-256 of the contents page, and each citation the URL and SHA-256 of the page it was read from. Fixed Time stages, which score without the time, are not in this record. Revolver limits the rounds before a reload, which the record does not hold.
- **DSB.** The Sportordnung lists the championships below the Landesmeisterschaft as examples that each Landesverband runs. The series and the ring values come from the discipline; a few Auflage disciplines score tenths at Landes- and Deutsche Meisterschaft (Teil 9, 9.4). The issue offered BDS instead of DSB at the owner's choice; DSB is the default.
