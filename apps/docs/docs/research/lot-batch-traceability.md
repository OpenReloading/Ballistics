---
title: Lot and batch traceability after the pre-release
description: Which slices of lot and batch traceability (lot record, trace from a lot, batch record, brass process steps, remaining amount, reminders, box label, cost) pass the bench gate, checked against the stored lot strings, session snapshots and the earlier inventory review.
---

# Lot and batch traceability after the pre-release

## Question

User records: which of eight traceability slices (lot record and picker, trace from a lot to its loads and sessions, batch record, dated brass process steps, remaining amount per lot, reminders, printed box label, cost per round) pass the bench gate, in what order, and what do the open shape questions (batch without a load, editable entries, amount entry, restore without duplicates, what the feature must not claim) resolve to?

## Method

Decided before the review.

- Gate and accept rule of [inventory and lifecycle records worth keeping](./inventory-lifecycle-records.md): a handloader fills the record in at the bench in under a minute, with what they know, and keeps it up without a reminder; a record that only stays right while it is maintained is dropped; the cheaper form (a search, a print, a typed number) is compared first. A verdict of that entry or of the rounds-on-hand decision (nothing stored, a number typed when needed) is reused, not decided again.
- Each slice: what the schema and the web app store today, what the user would type, and what the screen shows when the user stops typing.
- Reminders: a system notification must reach a user whose app is closed, with no server, on the browsers the app supports. Checked against the browser compatibility data and the specifications.
- Data: the repository's schema and web app at the time of the review; browser support from the MDN compatibility data. No user study.

## Formulas

No model equations. The one conversion the slices would need: 1 grain = 64.79891 mg exactly ([NIST SP 811, B.8](https://www.nist.gov/pml/special-publication-811/nist-guide-si-appendix-b-conversion-factors/nist-guide-si-appendix-b8)), already covered by the stored unit of mass, the gram (`packages/schema/src/units.ts`).

## Numbers

| Slice | Typed by the user | Shown when not kept up | Verdict |
| --- | --- | --- | --- |
| 1 Lot record and picker | lot, supplier, date per box | a lot without its later boxes | part of the own lots issue; the lot string stays the stored shape, a record is an optional reference beside it |
| 2 Trace from a lot | nothing: the lot strings of loads and session snapshots | nothing wrong: a load without a lot is not found | go: the Saved loads search also matches the lot strings |
| 3 Batch record | load, lots, quantity, date, charge per batch | a wrong quantity; old batches of a changed recipe | no-go: the session snapshot already keeps the lots, seating and round count of the load at the session; quantity is not stored |
| 4 Brass process steps | a dated step per process run | a missing step reads as not done | no-go: the case group keeps its firing count; the history of each case is not tracked |
| 5 Remaining amount per lot | every purchase and use | a wrong amount on hand | no-go (inventory review) |
| 6 Reminders | a due date or a minimum | a missed or false reminder | in-app notes only, which exist; no system notification, no calendar file |
| 7 Box label | nothing: printed from the load | not applicable | no build: the printed load sheet already carries the case and primer lots; a label size waits for users asking |
| 8 Cost per round | price and pack size per component | an old price | no-go (inventory review) |

Reminder routes:

| Route | Needs | Supported |
| --- | --- | --- |
| Push message | a server that sends to the subscription endpoint ([MDN, Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API)) | the app has no server |
| Periodic background sync | an installed web app, the browser's engagement score ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/Web_Periodic_Background_Synchronization_API)) | Chrome 80 and Chromium browsers; not Firefox, not Safari ([compatibility data](https://github.com/mdn/browser-compat-data/blob/main/api/ServiceWorkerRegistration.json)) |
| Calendar file | an event with a date ([RFC 5545](https://www.rfc-editor.org/rfc/rfc5545)) | any calendar, but nothing in the app has a due date |
| In-app note | nothing new | the load notes and the note at a round count |

## Result

no change. Nothing is built from this map except one search: the Saved loads search also matches the powder, primer and case lot strings of a load and of its session snapshots, which traces a lot to the loads and sessions that used it with no new record. The lot record stays in the own lots issue, as an optional reference beside the lot string, so no migration follows. A batch record, dated brass steps, remaining amounts, cost and system notifications are ruled out: each needs entries the user keeps up, and the session snapshot, the firing count and the load notes already hold what changes a calculation or a comparison.

The open shape questions resolve with no batch record: a batch without a load does not arise; amount entries, their correction and rounding do not arise with no stored amount; restore duplicates are handled by the per-record replace prompt of the import, keyed by record id. A lot, a load sheet and a trace are bookkeeping: no text calls a lot, a load or a batch safe or fit for use.

Not tracked: batches, quantities loaded or left, process history of cases, purchase prices, reminders outside the app, QR codes.

## Data basis

analytic. A review of the repository's schema and web app and of the browser compatibility data; no measured data and no user study.

## Where in the app

- `packages/schema/src/load.ts` (`lot` of a component, `powderLot`, the primer and case lots, `snapshots` with the lots of each session).
- `packages/schema/src/case.ts` (`numberOfFirings`, `trimLength`).
- `packages/schema/src/firearm.ts` (`roundCount`, `roundCountDate`, `noteAtRoundCount`).
- `apps/web/src/lib/load-tabs.ts` (`loadGroups`, the Saved loads search).
- `apps/web/src/lib/load-notes.ts` (the notes on a changed lot and on the round count).
- `apps/web/src/lib/data-files.ts` (the import's Replace prompt for a record with the id of a browser record).
- `apps/web/src/components/load-sheets.tsx` (the printed load sheet with the case and primer lots).

## Confidence

medium: the stored shapes and browser support are read from the code and the compatibility data, but no handloader was asked which records they would keep up.
