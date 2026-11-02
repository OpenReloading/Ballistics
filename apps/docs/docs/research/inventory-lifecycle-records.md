---
title: Inventory and lifecycle records worth keeping
description: Which stock, lot, brass, label, round count, cost, history and backup records a handloader would keep up without tracking every round, checked against the records the app already stores.
---

# Inventory and lifecycle records worth keeping

## Question

User records: which of eight inventory and lifecycle ideas (stock overview, batch to lots, case history, box labels, firearm round count, cost per batch, history of stock movements, local storage with backups) pass the bench gate, and in what form that reuses the stored records?

## Method

- Gate: a handloader fills the record in at the bench in under a minute, with what they know, and keeps it up without a reminder. Cheaper forms are compared first: a typed number, a filter, a print, a CSV.
- For each idea: what the schema and the web app store today, what the user would type and how often, what the screen shows when the user stops typing it, and whether the stored shape must change before 1.0.
- Accept rule: an idea is built only when it passes the gate and its failure mode shows no value or an age instead of a stale value. A record that only stays right while it is maintained is dropped. An idea that an open issue already covers is folded into it, not opened twice.

## Formulas

No model equations. The two quantities the ideas would compute:

- Remaining amount of a lot: the sum of its dated entries (purchase positive, use in a batch, discard and correction signed), computed, never stored, so it cannot disagree with its entries.
- Cost of one round: the sum over the components of pack price over pack size times the amount per round (one bullet, one primer, one case over its firings, the charge over the pack mass for the powder).

## Numbers

Bench work per idea, as fields typed and how often:

| Idea | Typed by the user | How often | Shown when not kept up |
| --- | --- | --- | --- |
| Stock of components | every purchase and every use, per lot | every session at the bench | a wrong amount on hand |
| Rounds loaded per load | one number | once per batch | a wrong count; the save time of the load as its age |
| Lots of a batch | the lot printed on each box, already a field | once per new box | nothing wrong: an empty lot is no lot |
| Brass firings | one counter on the case group, already a field | once per firing cycle | a low count; the save time of the record as its age |
| Box label | nothing: printed from the load | once per box | not applicable |
| Firearm round count | one number, already a field | after a range day | a low count; never written by a session |
| Cost per round | price and pack size per component | every purchase | an old price |
| History of stock movements | every change, by the app | always | not applicable |
| Backups | one export | the reminder after 10 changes or 7 days | data lost with the browser |

Verdicts over the nine rows (the stock idea is split into component stock and rounds loaded): no new record and no new issue; 5 folded into open issues (rounds loaded and round count into the load and firearm map, lots and brass into the own lots issue, the box label into the traceability issue as a pre-1.0 candidate), 3 dropped (component stock, cost, movement history), 1 confirmed as existing (backups).

## Result

no change. Nothing was built. The kept parts are folded into the open issues on own lots (lot strings stay the stored shape; a lot record later is an optional reference beside the string, which needs no migration), on the load and firearm link (rounds loaded as one number on the load; the round count gains the shots of a session on one confirm, and shows its age), and on traceability (a box label printed from the load; the [lot and batch traceability](./lot-batch-traceability.md) entry records the decision that the label carries a QR code naming the load). Component stock, cost per round and a history of stock movements are dropped: each shows a wrong value once the user stops typing, and a notebook or spreadsheet does the job.

Not tracked: rounds or cases one by one (no serial per round or per case), the history of each case, the remaining amount of a powder, primer or bullet lot, purchase prices, an audit trail of changes, scanning of labels.

## Data basis

analytic. A review of the repository's schema and web app; no measured data and no user study.

## Where in the app

- `packages/schema/src/load.ts` (`lot` of a component, `powderLot`, `primer.lot`, `case.lot` and `case.firingCount` of a load, the lots and `roundCount` of a session snapshot).
- `packages/schema/src/firearm.ts` (`roundCount`, `noteAtRoundCount`).
- `packages/schema/src/case.ts` (`numberOfFirings`, `trimLength`, `annealed` as delivered).
- `packages/schema/src/user-data.ts` (the record kinds and `saved`).
- `apps/web/src/lib/range-entry.ts` (`withSession`, the snapshot of the lots and the round count).
- `apps/web/src/lib/load-notes.ts` (the notes on a changed lot and on the round count).
- `apps/web/src/lib/case-group.ts` (the fields of a case group).
- `apps/web/src/lib/export-reminder.ts` and `apps/web/src/lib/user-store.ts` (the export reminder, persistent storage).
- `apps/web/src/components/load-sheets.tsx` (the printed load sheets, the base of a box label).

## Confidence

medium: the stored shapes and their uses are read from the code, but the bench times are estimates of the fields typed and no handloader was asked which records they would keep up.
