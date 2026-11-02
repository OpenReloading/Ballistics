---
title: Derived load and firearm views, their place and the discipline filter
description: Where the derived load and firearm views go, in which order they are built, and whether the filter from a firearm to the disciplines needs a firearm category, checked against the stored disciplines, caliber classes and the pages that would host each view.
---

# Derived load and firearm views, their place and the discipline filter

## Question

User records: where do the derived load and firearm views go (columns, notes and filters on existing pages, one overview page, or tabs on a firearm page), which goes first, and does the filter from a firearm to the disciplines need a firearm category, or is the caliber class of the firearm's cartridge enough?

## Method

- Gate: a handloader uses the view at the bench in under a minute, with what they know, and types nothing to keep it right. A column, note, filter, link or print on a page that exists comes before a new page ([load, firearm and data views without a tracker](./load-firearm-data-views.md)).
- Place: for each kept view, the page that already shows its records, and whether that page can host it without a new control.
- Filter: every discipline record and caliber class record of the data package, counted by the caliber classes and the category each discipline states. Accept rule for a stored firearm category: it is added only if the caliber class alone gives wrong matches that the list cannot already narrow, and the category would remove them.

## Formulas

No model equations. The filter keeps a discipline $d$ for a firearm $f$ when

- $k(c_f) \in K_d$, with $c_f$ the cartridge of the firearm, $k$ the one caliber class whose member list names it, and $K_d$ the caliber classes the discipline states.

A cartridge in no class has no $k$, and a discipline that states no class has no $K_d$: neither is matched, and neither is shown as not allowed.

## Numbers

Disciplines and caliber classes in the data package:

| Count | Value |
| --- | --- |
| Discipline records | 376 |
| that state caliber classes | 204 (79 named by the rule book, 125 derived from a stated range or gauge) |
| that state no caliber class | 172 |
| that state a category | 324 (11 categories) |
| that state no category | 52 |
| that state classes and no category | 29 |
| Caliber classes | 23, one without a cartridge (airgun) |
| Cartridges in a class | 58 of 577, each in exactly one class |

Disciplines that name a class, by category (three classes as examples):

| Class | Disciplines | Handgun categories | Rifle, carbine and lever-action categories | No category |
| --- | --- | --- | --- | --- |
| 9 mm pistol | 50 | 6 | 26 | 18 |
| .22 rimfire | 83 | 13 | 51 | 19 |
| .30 rifle | 76 | 1 | 72 | 3 |

The class alone matches across kinds of firearm: a 9 mm pistol is shown 26 carbine and rifle disciplines, a .22 rimfire pistol 51 rifle disciplines. The discipline list already has a category filter beside the caliber class filter, both kept in the URL, so one click narrows the list to the firearm's kind. A stored firearm category would not narrow the 52 disciplines without a category, and a firearm kind maps to several discipline categories (a revolver in a .357 class is in 2 revolver and 4 pistol disciplines), so an equality match drops disciplines a revolver may shoot.

Hosts of the kept views: the Saved loads drawer (one line per load), the firearm list, the discipline list with its facet filters, the per load range card print, the CSV helper and the load notes all exist. No kept view needs a new page except loads side by side, which follows the compare page of the bullets.

Verdicts: place option 1 (existing pages) passes; option 2 (an overview page) and option 3 (tabs on a firearm page) fail the existing-page rule. Filter option A (caliber class only) passes with the category filter of the list; option B (a stored firearm category) fails the accept rule.

## Result

no change. Nothing was built; the review recommends:

- Place: columns, notes, a link, prints and CSV on the existing pages. The filter becomes a link from the firearm's row to the discipline list with its caliber class filter set, so the discipline list gets no new control. It is labelled as the disciplines that name the class, not as the disciplines the firearm may shoot, because 172 disciplines state no class. A firearm whose cartridge is in no class (or is the user's own cartridge) gets no link.
- Order: the Saved loads line and firearm list column (firearm, sessions, last session), gap and cartridge mismatch notes, CSV export, the discipline link, the dope card per firearm. Loads side by side and the data quality notes wait for the owner: the first is a new page, the second has no defined set of fields yet.
- No stored field: the firearm keeps its cartridge and no category. A category stays additive if the list's category filter proves too coarse in use.

Not matched: a cartridge by bullet diameter when it is in no class. Classes of one diameter cannot be told apart by it.

## Data basis

analytic. Counts over the data package's discipline and caliber class records and a review of the web app; no measured data and no user study.

## Where in the app

- `packages/schema/src/federation.ts` (`category` and `caliberClasses` of a discipline).
- `packages/schema/src/caliber-class.ts` (the member cartridges of a class).
- `packages/data/src/caliber-classes.ts` (each member in one class only).
- `packages/schema/src/firearm.ts` (`cartridge`, no category).
- `apps/web/src/lib/disciplines.ts` (the category and caliber class filters of the discipline list).
- `apps/web/src/lib/directory.ts` and `apps/web/src/components/directory-table.tsx` (filters kept in the URL).
- `apps/web/src/components/saved-loads.tsx` and `apps/web/src/components/firearm-library.tsx` (the hosts of the line and the column).
- `apps/web/src/lib/range-card.ts` and `apps/web/src/components/range-card.tsx` (the printed range card).
- `apps/web/src/lib/csv.ts` (CSV output).
- `apps/web/src/components/bullet-compare-view.tsx` (the compare page with `?ids=`).

## Confidence

medium: the counts come from the records and the hosts from the code; whether the one-click category filter is enough in use, and how many firearms of users have a cartridge outside the 58 in a class, are not measured.
