---
title: Firearm round count, its age and the shots of a session
description: Whether the firearm round count should show its age from the record's save time or from a date of its own, and how a session's shots reach the count on one confirm, checked against the code that writes the firearm and the sessions.
---

# Firearm round count, its age and the shots of a session

## Question

User records: can the firearm round count stay current without a hand tally, by showing its age (no date, the record's save time, or a date beside the count) and by offering to add a session's shots on one confirm?

## Method

Decided before the review.

- Gate: a handloader confirms or types the count at the bench or the range in under a minute. Cheaper forms first: typing the count (exists), the age from the record's save time (no stored change), then a new optional field.
- Accept rule for the age, from the inventory review ([inventory and lifecycle records](./inventory-lifecycle-records.md)): when the user stops updating the count, the shown age tells it is stale. An age that moves while the count does not fails.
- For each age option: every code path that writes the firearm record and so moves its `saved` time, and whether that write changes the count.
- For the update: every place a session is created, whether it has one save moment, what the shots of a session are, and what happens on a second offer for the same session (a reload, a second tab).
- Data: the repository's schema and web app. No user study.

## Formulas

No model equations. The count after an accepted offer:

- $N' = N + n$, with $N$ the stored round count of the firearm and $n$ the shots of the session for loads shot from it, excluded shots included (they were fired). $n$ is prefilled and editable: fouling shots, sighters and shots the chronograph missed are fired but not recorded.
- Offered only when $N$ is set. Without it $N' = n$ would read as the barrel's whole life.
- Already counted when $N \ge S + n$, with $S$ the count the session's snapshot recorded at its first shot. This holds when nothing else changed the count in between; a count typed in between can make it offer again or stay silent.

## Numbers

Writes of the firearm record that move its `saved` time:

| Writer | Changes the round count | When |
| --- | --- | --- |
| Firearm editor, the count field | yes | when the user types it |
| Firearm editor, any other field (optics, configurations, the active configuration, notes) | no | any edit |
| Truing session, store the result (`withTruing`) | no | at the range, on a shooting day |

2 of the 3 writers move `saved` without touching the count, one of them on the range day itself: "n rounds, saved on <today>" would show beside a count from weeks ago.

Places that create a session:

| Place | Save moment | Shots known |
| --- | --- | --- |
| Range page (`use-range-mode.ts`) | none: each shot is written as it is entered, the session is linked to the load at the first shot, and every tab and reload of the same load and day writes the same record (`rangeSessionId`) | the shots of the strings so far |
| Measurements tab, a chronograph file | one, when the read file is saved | the shots of the strings mapped to a load |

Verdicts: age option 1 (no date) and option 2 (save time) fail the accept rule; option 3 (a date beside the count) passes. Update B passes the gate (one click, the number prefilled), with an explicit action on the range page in place of a save prompt.

## Result

no change. Nothing built; recommended:

- Age: one optional `roundCountDate` on the firearm, an ISO 8601 day, set whenever the count is typed or a session's shots are added, shown beside the count in the firearm editor's head and on the firearm data card. An additive optional field, like `imported.day` of a user record; a firearm without it shows the count without an age. Not `saved`, which other edits move (see Numbers).
- Update: on the range page, an action "Add n shots to the round count of <firearm>" with $n$ prefilled from the session and editable; after the Measurements tab saves a chronograph file, one confirm per firearm, $n$ summed over the strings whose load names it. Declined: nothing changes. The check and the addition run in one transaction on the firearm record. Offered only for a firearm of this browser whose count is set.
- Side effect: a session snapshot records the count at its first shot, so a count kept current by B lets the existing round count note (`noteAtRoundCount`) fire without typing.

Not tracked: rounds per day, a history of the count, a count per barrel when a barrel is swapped.

## Data basis

analytic. A review of the repository's schema and web app; no measured data, no user study.

## Where in the app

- `packages/schema/src/firearm.ts` (`roundCount`, `noteAtRoundCount`).
- `packages/schema/src/user-data.ts` (`saved`, `imported.day`).
- `packages/schema/src/load.ts` (`roundCount` of a session snapshot).
- `apps/web/src/lib/range-entry.ts` (`rangeSessionId`, `withSession`).
- `apps/web/src/components/use-range-mode.ts` (each shot written, the session linked at the first shot).
- `apps/web/src/lib/truing-session.ts` (`withTruing`, which saves the firearm).
- `apps/web/src/components/measurements.tsx` and `apps/web/src/lib/measurements.ts` (a chronograph file saved as a session).
- `apps/web/src/components/firearm-editor.tsx` and `apps/web/src/components/firearm-data-card.tsx` (where the count shows).
- `apps/web/src/components/confirm.tsx` (`confirmDialog`).

## Confidence

medium: the writers of the firearm record and the places that create a session are read from the code; the bench time is an estimate, and no handloader was asked how far the recorded shots fall short of the rounds fired.
