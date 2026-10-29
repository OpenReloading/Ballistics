---
title: Load, firearm and data views without a tracker
description: Which views of loads, firearms and sessions are kept because they need no data entry, and which are ruled out because they only stay right while a user keeps typing counts.
---

# Load, firearm and data views without a tracker

## Question

User records: which of the views planned from the link between a load and a firearm and from the records users already store need no ongoing data entry, and which are ruled out because they depend on a stored quantity, a decrement or many logged sessions?

## Method

Decided before the review.

- Candidates: the seven views of the load and firearm connection map and the ten views of the data views map, merged where they are the same view.
- Rule 1: a view that needs ongoing data entry (rounds made, on hand or fired, a yearly rounds summary, an over-time view that needs many logged sessions) is ruled out, unless it rests on one optional typed value shown with its date, and shown as stale when old.
- Rule 2: a view derived from fields already stored (the firearm of a load, the cartridge of a firearm, the sessions of a load, the record defaults of a load's inputs) is kept, in its cheapest form: a column, a note, a filter, a print or a CSV before a page.
- Rule 3: "enough rounds for the match" is kept only as a stateless sum compared with a number typed at that moment.
- A question that would change a stored shape is not decided here; it becomes a grilling ticket for the owner.
- Data: the repository's schema and web app at the time of the review. No user study.

## Formulas

No model equations. The one sum the planner computes, never stored:

- Rounds needed: the shots that count per event (summed over the stages of the discipline), times the number of events, plus the sighters per event times the events, then raised by the reserve in percent and rounded up. The result is compared with the rounds on hand the user types: a positive difference is reported as short by that many rounds, a negative one as that many over.

## Numbers

Verdict per view, with the confidence of each:

| View | Needs entry | Verdict | Confidence |
| --- | --- | --- | --- |
| Loads per firearm, firearm of a load | no | kept: line and column | high |
| Gaps and cartridge mismatches | no | kept: load notes and a count | high |
| Firearm to discipline filter | no | kept: filter by caliber class | medium |
| Dope card | no | kept: range cards of all loads of a firearm | medium |
| Loads side by side | no | kept: compare page | medium |
| Data quality, record default against measured | no | kept: load notes | medium |
| Stale or untested loads | no | kept: sessions and last session | high |
| CSV export | no | kept | high |
| Model against measurement | no | exists | high |
| Enough for the match | one number at that moment | kept as a stateless planner | medium |
| Rounds made, stored | every loading session | ruled out | high |
| Rounds fired, stored or decremented | every range day | ruled out | high |
| Rounds on hand, decremented | every range day | ruled out; a typed dated number is a grilling question | medium |
| Barrel life against rounds made | every loading session | ruled out | medium |
| Velocity and group over time | many logged sessions | ruled out | medium |
| Charge ladder results across seasons | several seasons of ladders | ruled out | medium |
| Yearly summary | every range day | ruled out here, moved to the shooting log spike | high |

Totals: 10 views kept (one of them exists), 7 ruled out, 0 stored-shape changes, 4 grilling tickets (rounds on hand, the planner, the firearm round count with its age, the place of the derived views).

## Result

no change. Nothing was built. The kept views are derived from records already stored and go to the existing pages as lines, notes, a filter, prints and CSV. The match check becomes a stateless sum against a typed number. Every view that rests on a count the user must keep up is ruled out: a skipped entry leaves a wrong number that looks right, and the screen cannot tell. The over-time views are ruled out because they say nothing until many sessions are logged; the sessions of a load are already listed with their statistics. The firearm round count stays the one counter, shown with its age.

## Data basis

analytic. A review of the repository's schema and web app; no measured data and no user study.

## Where in the app

- `packages/schema/src/load.ts` (`firearm`, `cartridge` and the sessions of a load).
- `packages/schema/src/firearm.ts` (`cartridge`, `roundCount`, `noteAtRoundCount`).
- `packages/schema/src/federation.ts` (`shotCount` of a target mapping, `category` and `caliberClasses` of a discipline).
- `packages/schema/src/chrono-session.ts` (the optional `date` of a session).
- `packages/schema/src/user-data.ts` (`saved` of a record).
- `apps/web/src/components/saved-loads.tsx` (the Saved loads drawer).
- `apps/web/src/lib/load-notes.ts` (the load notes).
- `apps/web/src/lib/your-data.ts` (the counts per kind).
- `apps/web/src/lib/range-card.ts` (the printed range card).
- `apps/web/src/lib/csv.ts` (CSV output).
- `apps/web/src/lib/range-entry.ts` (the round count kept with each session).

## Confidence

medium: the stored shapes and what each view reads come from the code, but which kept views users open and how long a typed number stays current are judgments, not measured; no handloader was asked.
