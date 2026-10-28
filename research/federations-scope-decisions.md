# Decisions for the federation scope of 1.0

Question (issue 333): which countries and sports the Federations list covers at 1.0, and how practical-shooting sports fit a model built for ring-scored target disciplines.

Short answer: Germany and the ISSF only at 1.0, further bodies after 1.0 in the order of the national-federations note. Practical shooting is not a 1.0 data topic. The `discipline` shape stays as it is because no change is needed for the 1.0 scope, and practical sports get their own record kind after 1.0, added beside the existing kinds. No record, schema or code changes with this note.

Sources: the two research notes this depends on, `research/practical-shooting-bodies.md` (issue 331) and `research/national-federations.md` (issue 332), both retrieved 2026-10-27. Rule books are described in my own words; no rule text is copied and sources are named as bodies and URLs only. Confidence labels are those of the notes: **confirmed** (read in the publisher's own document), **partial** (search-engine excerpt only), **unverified** (not found in a primary source).

## What exists today (checked on `main`, 2026-10-28)

- Federation records: 6 in `packages/data/records/federations/` (BDMP, BDS, DSB, DSU, VdRBw, ISSF). The ISSF record cites the 2025 third print.
- `federation` (`packages/schema/src/federation.ts:30`): country code or `international`, optional `internationalFederation` (`:39`), rule books with a hash.
- `discipline` (`:71`): `distance` is required (`:87`); `category` is optional and a fixed list with no practical or shotgun entry (`:11`, `:89`).
- `targetMapping` (`:114`): one discipline on one event of a ring-scored face, `shotCount` optional (`:127`), present on 389 of 418 records.
- 376 `disciplines` records. The workbench already computes the IPSC power factor (`ipscPowerFactor` in `apps/web/src/lib/power-factor.ts`, read by `apps/web/src/components/workbench-readouts.tsx`).
- Practical sports (issue 331, confirmed unless marked): no fixed distance per discipline (IPSC handgun, USPSA, IDPA, ICORE set it per stage), the stage is the unit of competition, scoring is zones with a hit factor or time-plus, not rings, no body publishes a reuse licence, and "IPSC Targets" is a registered mark of IPSC. Action Air is an IPSC discipline with its own rule book.
- National bodies (issue 332): twelve ranked candidates; almost every ISSF member that publishes rules does so as a translation of the ISSF book plus a short national layer, so few new faces. Faces worth drawing are those of the NRA of America, the NSRA, the NBRSA, ICFRA F-Class and one Austrian national 100 m face. No body states an open licence; Finland's SAL permits copying and printing the online versions, which is not an open licence.

## Decisions

| # | Question | Options | Recommendation and reasoning | Cost of being wrong | Default until overruled |
|---|---|---|---|---|---|
| 1 | Countries at 1.0 | (a) Germany and the ISSF, (b) add a short list now, (c) add every ISSF member | (a). Each new body costs a reading of its rule book and faces to draw, and most national books only translate the ISSF book, so a record adds a federation entry and little else. After 1.0, one body at a time in the order of issue 332: NRA (US), NSRA (UK), Swiss Shooting, KNSA (NL), ÖSB (AT). (c) is rejected: the ISSF lists 163 member federations and most would be records without a new face or discipline. | low: a federation is an additive record | the six records stay |
| 2 | Practical shooting a 1.0 data topic | (a) after 1.0 with the competition events, (b) federation records and a few faces now, (c) now, with a new record kind | (a). The stage, not the discipline, is the unit, and there is no ring scoring, so a face would score nothing the 1.0 workbench can use. The competition-event issues (#221 stage builder, #222 competition event MVP) are after 1.0 and are where stages and hit factors belong. The power factor stays a workbench calculation. | low | no practical records, power factor unchanged |
| 3 | A discipline without a fixed distance | (a) make `distance` optional, (b) a placeholder distance, (c) leave `discipline` and add a record kind for practical sports after 1.0 | (c). Making `distance` optional or filling a fake value would change or bend a shape that is frozen at 1.0 (`federation.ts:87`). A course-of-fire or stage record holds what the rule book fixes: round limit and course type, scoring method, target types and counts, maximum points; distance is not a rule-book value for IPSC handgun, USPSA, IDPA or ICORE (issue 331). It is added without touching existing kinds. No schema change is needed at 1.0 because the 1.0 scope (decisions 1 and 2) adds no discipline the current shape cannot hold. | a later split is additive; changing `discipline` after 1.0 would not be | no schema change |
| 4 | Official target shapes as faces | (a) none at 1.0, (b) IPSC and USPSA targets now | (a). When added: a face is drawn from stated dimensions with the rule-book page in its provenance, a test recomputes the zone sizes, `npm run data:validate` runs, and the owner spot-checks the zones. The IPSC Target is 45 cm by 57 cm with zones A, C and D (confirmed from IPSC's published diagram), but the shape is shipped only after the owner decides about the registered mark (open point of issue 331); the USPSA target image was not retrieved (unverified). | low | no practical faces |
| 5 | Affiliates and platform bodies | (a) a record per body that publishes a rule book, (b) a record per IPSC region, (c) platforms as federations | (a). A federation record is a body that publishes a rule book. A regional affiliate is its own record with `internationalFederation` set: USPSA is the US region of IPSC (partial: IPSC's regions page lists "IPSC United States - USA"; the USPSA site could not be loaded). IPSC's regions page lists 111 entries (my count, confirmed) with a postal address and a contact each, not a rule book, so (b) would add 111 records without a rule book. Action Air is an IPSC discipline and 3-Gun is a USPSA rule book, so neither is a federation record. The list shows the country code or "international" as today. | low | as stated |
| 6 | Pasted claims in public text | (a) all, (b) confirmed only, (c) none | (b). Allowed as fact: IPSC founded 1976, motto *Diligentia, Vis, Celeritas*, USPSA has its own rule book and target, ICORE is revolver-only, Steel Challenge is five plates timed (most stages from one box; misses add 3 s). Written as "reported" with the source: USPSA as the US region of IPSC, 3-Gun needing at least two firearm types per match (not three per course). Left out: micro-regions, the head box against the hexagonal Classic target, IDPA gear and order of engagement (site offline, rule book unread). | low | as stated |

## Build issue drafts (none opened)

- After 1.0, one issue per federation in the order of decision 1: "records and faces from one rule book", with the rule-book hash. Each reads the book, adds the federation and its disciplines, draws only faces the ISSF set lacks, and re-expresses dimensions in own words.
- After 1.0: a spec issue for the course-of-fire record kind (decision 3), blocked by #221 and #222.
- After 1.0: a decision on shipping the IPSC and USPSA target outlines (decision 4), owner-gated.
- Now, optional: check whether a newer ISSF print than the one cited exists. Issue 332 saw a 2026 book effective 1 July 2026 on the US and Canadian federation pages; its edition data is unverified.

Independent: issue 18 (rule facts per stage).

## Not checked

- The ISSF 2026 rule book, the USPSA target outline, the IDPA rule book, and the legal notices of the national bodies (reuse terms) are as unverified here as in the two source notes.
- No shooter-count figures were gathered; the ranking of issue 332 is by rule-book content and effort.
