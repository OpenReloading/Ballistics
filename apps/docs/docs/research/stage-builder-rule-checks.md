---

title: Stage builder rule checks
description: Whether a 2D stage planner can check a practical-shooting stage against the IPSC, USPSA and BDS rule books, which checks it needs, and the rule-book clause each check cites.
---

# Stage builder rule checks

## Question

Stage builder: can a person draw a practical-shooting stage in 2D and have it checked against more than one rule set (IPSC Handgun, USPSA, BDS), with each warning naming the rule set, its edition and the clause, and which checks does the first build need?

## Method

The current edition of each rule book, from the federation's own publication, was read for the stage design, target, magazine and moving-target rules ([IPSC 2026](../bibliography.md#ipsc-2026), [USPSA 2026](../bibliography.md#uspsa-2026), [BDS 2026](../bibliography.md#bds-2026), [BDS 2026, Allgemeiner Teil](../bibliography.md#bds-2026-a)). Accept rule, set in advance: a check is in the first build when it follows from the 2D geometry and the counts of a stage alone, without a 3D model, a person's judgment on the range or a rule outside the rule book.

Each clause in the list below has one status:

- **cited**: an event type record in the catalog cites the clause with its page, read in the rule book (`packages/catalog/records/event-types/`).
- **unverified**: the clause number was not re-read in the rule book for this page, or no clause number is recorded. The build issue of the check reads the clause in the edition named and records the page before the check ships.

### Clause list

| Check                                                                                 | Rule set                    | Edition                                                      | Clause                                                                 | Status                                            |
| ------------------------------------------------------------------------------------- | --------------------------- | ------------------------------------------------------------ | ---------------------------------------------------------------------- | ------------------------------------------------- |
| Stage briefing contents (what the stage record holds)                                 | IPSC Handgun                | January 2026                                                 | 3.2.1                                                                  | unverified                                        |
| Stage briefing contents                                                               | USPSA                       | 2026-09                                                      | 3.2.1                                                                  | unverified                                        |
| Steel at least 7 m from every shooting position                                       | IPSC Handgun                | January 2026                                                 | not recorded                                                           | unverified                                        |
| Steel at least 23 ft from every shooting position                                     | USPSA                       | 2026-09                                                      | not recorded                                                           | unverified                                        |
| Fault line keeps the approach to steel at 8 m or more                                 | IPSC Handgun                | January 2026                                                 | not recorded                                                           | unverified                                        |
| Barrier keeps the approach to steel at the clause figure (7 m or 8 m, to confirm)     | IPSC Handgun                | January 2026                                                 | not recorded                                                           | unverified                                        |
| Fault line keeps the approach to steel at 26 ft or more                               | USPSA                       | 2026-09                                                      | not recorded                                                           | unverified                                        |
| Barrier keeps the approach to steel at the clause figure (23 ft or 26 ft, to confirm) | USPSA                       | 2026-09                                                      | not recorded                                                           | unverified                                        |
| Round count within the cap of the course type (short, medium, long)                   | IPSC Handgun                | January 2026                                                 | not recorded                                                           | unverified                                        |
| Round count within the cap of the course type                                         | USPSA                       | 2026-09                                                      | not recorded                                                           | unverified                                        |
| Scoring hits visible from one place within the limit                                  | IPSC (rule book to confirm) | not recorded                                                 | not recorded                                                           | unverified                                        |
| At most 8 scoring hits visible from one place                                         | USPSA                       | 2026-09                                                      | not recorded                                                           | unverified                                        |
| At least one paper target or popper in the stage                                      | IPSC Handgun, USPSA         | January 2026, 2026-09                                        | not recorded                                                           | unverified                                        |
| No-shoots and hard cover do not hide the whole A zone of a scoring target             | IPSC Handgun, USPSA         | January 2026, 2026-09                                        | not recorded                                                           | unverified                                        |
| Paper target tilt within the limit                                                    | IPSC Handgun, USPSA         | January 2026, 2026-09                                        | not recorded                                                           | unverified                                        |
| Fault line size                                                                       | IPSC Handgun, USPSA         | January 2026, 2026-09                                        | not recorded                                                           | unverified                                        |
| Barrier and obstacle heights                                                          | IPSC Handgun, USPSA         | January 2026, 2026-09                                        | not recorded                                                           | unverified                                        |
| Magazine capacity and length per division (the stage's division limits)               | IPSC Handgun                | January 2026                                                 | Appendix D1 item 8, D3 item 20, D4 item 18.2, D4a item 18.2, D6 item 8 | cited                                             |
| Magazine capacity and length per division                                             | USPSA                       | 2026-09                                                      | Appendix D1 to D5, D7 and D9, items as in the record                   | cited                                             |
| Moving targets allowed                                                                | IPSC Handgun                | January 2026                                                 | 4.1.6; 9.9.1 and 9.9.2                                                 | cited                                             |
| Moving targets allowed; angle of a moving target at rest                              | USPSA                       | 2026-09                                                      | 9.9.1 and 9.9.2; 2.1.8.4                                               | cited                                             |
| Each check above where BDS sets its own figure or clause                              | BDS                         | Sporthandbuch 2026 (Allgemeiner Teil, Kurzwaffen, Kommentar) | not recorded                                                           | unverified (BDS clause not re-read for this page) |

The cited rows hold the rule set's limit per division; the stage builder reads them from the event type records and does not copy them. The IPSC row on scoring hits names no rule book and no figure: the build issue finds the IPSC rule book that sets the limit, with its edition, before the check ships. Barrier and fault line are separate checks because the rule books may set different distances for them; the build issue reads the clause and settles each figure. Germany: the BDS rows also cover what German law sets for the organizer; no legal limit is stated here, each is checked in the BDS text and marked cited or unverified.

## Formulas

All positions are in mm in the stage plane, angles in degrees. Steel distance: the shortest distance from any point of a shooting area polygon to the steel target's position, against the rule set's minimum ([IPSC 2026](../bibliography.md#ipsc-2026), [USPSA 2026](../bibliography.md#uspsa-2026)). A USPSA figure in feet is converted with 1 ft = 304.8 mm (exact), so 23 ft is 7010.4 mm and 26 ft is 7924.8 mm. Visibility: a scoring zone is visible from a position when a straight segment from the position to a point of the zone crosses no hard cover, wall or barrier polygon; the hits visible from a position are the sum of the required hits of the targets visible from that position, and the check compares the largest such sum over all positions of a shooting area against the limit. A union over the whole area would overcount: an area with 6 hits visible only from its left end and 6 only from its right end has at most 6 visible from one position. Whether the rule books count per position or per view is unverified; the build issue reads the clause wording before the check ships.

## Numbers

Every figure below is unverified, as in the clause list: it was not re-read in the rule book for this page.

- Steel minimum distance: 7 m (IPSC), 23 ft = 7010.4 mm (USPSA).
- Fault line in front of steel: 8 m (IPSC), 26 ft = 7924.8 mm (USPSA).
- Barrier in front of steel: 7 m or 8 m (IPSC), 23 ft or 26 ft (USPSA), to confirm.
- Scoring hits visible from one position: at most 8 (USPSA); IPSC rule book and figure to confirm.
- No check needs a 3D model: every check is a distance, an intersection or a count in the stage plane.

## Result

no change. Not adopted in code: go for a 2D build after the first release, as six pull requests in this order:

1. Stage record kind (a user record in mm and degrees with the briefing contents of IPSC 3.2.1 and USPSA 3.2.1) and rule-set check records per edition and clause, on top of the event type records.
2. Geometry in `packages/svg-drawings`: shooting areas, fault lines, targets with zones, steel, no-shoots, hard cover, barriers, and visibility from a position.
3. Checks next to the competition rule logic in `packages/shot-groups/src/competition-scoring.ts`, whose tests already name their clauses, or in `packages/ballistics` (or a later package), each citing rule set, edition and clause, from the clause list above; a warning is advice, not a ruling.
4. The smallest useful editor: a 2D canvas with snap and the warnings with rule set, edition and clause.
5. Briefing print, image and JSON export.
6. BDS checks, each after its BDS clause is read in the edition named.

A stage can pass one rule set and warn on another. Out of scope for the first build: the IPSC Target Array Book (moving target arrays), the BDS rifle and mini rifle volumes, numeric qualification limits. Target outlines drawn from published dimensions may ship only under the conditions answered in #648: a neutral face name, the body named only in the rule-book citation, no logo or approval claim, and no copy or trace of the body's drawing; further national bodies come one at a time (#649).

## Data basis

public: the IPSC Handgun Competition Rules (January 2026), the USPSA Competition Rules (2026-09) and the BDS Sporthandbuch (2026), as listed in the [bibliography](../bibliography.md); the cited clauses through the event type records.

## Where in the app

- `packages/catalog/records/event-types/ipsc-handgun.json`, `packages/catalog/records/event-types/uspsa-handgun.json`: magazine and moving-target clauses.
- `packages/catalog/records/sources/ipsc-handgun-rules-2026-01.json`, `packages/catalog/records/sources/uspsa-competition-rules-2026-09.json`, `packages/catalog/records/sources/bds-sporthandbuch-allgemein-2026.json`, `packages/catalog/records/sources/bds-sporthandbuch-kurzwaffen-2026.json`: the rule book editions.
- `packages/schema/src/event-type.ts`: the event type the stage record builds on.
- `packages/svg-drawings/src/index.ts`, `packages/ballistics/src/index.ts`: where the geometry and the checks go.
- `packages/shot-groups/src/competition-scoring.ts`: competition rule logic with clause-named tests, a candidate home for the checks.
- Data page: [event types](../data/event-types.md).

## Confidence

low for the clause numbers: only the magazine and moving-target clauses are cited from the rule book, every other clause is unverified until its build issue reads it; medium for the scope, since every check listed is a 2D distance, intersection or count.
