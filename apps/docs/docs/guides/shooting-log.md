---
title: Shooting log
description: The range days of the shooting log (Schießbuch) in the web app, how their rounds reach a firearm's round count, the yearly summary, and the columns of its print, CSV and JSON.
---

# Shooting log

The shooting log on the Firearms page (**Shooting log**, `/firearms/log`) keeps one entry per range day in this browser. The log is your own record. Whether a club or an authority accepts it is up to them: the app does not claim that the log meets any rule. No statute names a personal shooting log or its fields; the proof of need for a firearm comes from the club or federation ([WaffG § 14 and § 15](https://www.gesetze-im-internet.de/waffg_2002/)).

## An entry

| Field | What it holds |
| --- | --- |
| Date | The day, required. |
| Place | The range or club, as text. |
| Discipline | A discipline of the catalogue, optional. |
| Firearm | A firearm of your library, optional. |
| Load or factory ammunition | A saved load, or the factory ammunition as text; not both. |
| Rounds fired | Required, 0 or more. |
| Result | As you write it, such as rings or a placing. |
| Competition event | One of your [competition events](competition-events.md), optional; choosing one fills an empty result with the event's total, and how it ended when it was not completed. The list shows the event's name. |
| Confirmed by, Confirmed on | Who confirmed the entry, as you type it, and the day; a day needs a name. |
| Notes | Plain text. |

The record is a user record of kind `shootingLogEntry` ([Glossary](https://github.com/OpenReloading/Ballistics/blob/main/GLOSSARY.md)). An app version without this kind skips such records when it opens a file and says how many it skipped.

## Round count

Saving an entry with a firearm that has a round count asks once whether to add the entry's rounds to it. Only a yes changes the count; No leaves it as it was. The firearm notes the rounds it took from the entry, so saving the entry again asks only about rounds added since. A firearm without a round count is not changed: set a count on the Firearms page first. The count only grows through the log: changing an entry's firearm, lowering its rounds or deleting it takes no rounds back from a count, so correct the count on the Firearms page then. The shooting log keeps no second total: the firearm's round count is the one counter.

## Filters, print and export

The firearm and year filters are kept in the address; From and To narrow the entries to a day range. Print, Export CSV and Export JSON take the entries the filters show.

- **Print** gives one line per entry with a blank Signature column for the club's confirmation, the firearm and period the filters name, and the number of entries and rounds. It leaves out the notes and writes the confirmation's name and day in one column.
- **Export CSV** writes `openreloading-shooting-log-<day>.csv`, UTF-8 with a byte order mark, one row per entry in the order of the dates:

| Column | Content |
| --- | --- |
| `Date` | Day, `YYYY-MM-DD`. |
| `Place` | Text. |
| `Discipline` | The discipline's number and name, or its id when the catalogue is unreachable. |
| `Firearm` | The firearm's name in this browser. |
| `Load or ammunition` | The saved load's name, or the factory ammunition. |
| `Rounds` | Rounds fired, a whole number. |
| `Result` | Text. |
| `Notes` | Text. |
| `Confirmed by` | Text. |
| `Confirmed on` | Day, `YYYY-MM-DD`. |

A text a spreadsheet would read as a formula starts with an apostrophe.

- **Export JSON** writes `openreloading-shooting-log-<day>.json`, a user data file with the entries. **Import JSON** reads it back: new entries are added, equal ones left, and entries that differ from the browser's are replaced after one question. An entry whose id another record of the browser holds is not imported, and the report counts it. The firearms and loads the entries name are not in the file; in another browser their names show as not in this browser.

## Yearly summary

Under the entries, **Yearly summary** adds up the entries of one calendar year: the year the year filter names, else the latest year with entries; **Summary year** picks another until the year filter changes. It sums the log. The firearm's round count stays the one counter, and the summary does not change it.

- **Rounds per firearm**: the rounds and entries of each firearm, most rounds first. Entries without a firearm count on a row of their own.
- **Rounds per cartridge**: the cartridge of the entry's saved load, or of the load's firearm when the load names no cartridge. An entry without a saved load (factory ammunition) counts under its firearm only, and a line under the table gives its rounds.
- **Range days per month**: the entries of each month.
- **Competitions**: the [competition events](competition-events.md) dated in the year, each once, with its day, name, total (and how it ended when it was not completed) and the number of the year's entries that link it. **Summary year** also offers a year with events but no entries.

**Print summary** prints the summary alone. **Export summary CSV** writes `openreloading-shooting-log-<year>-summary.csv` (UTF-8 with a byte order mark) with the same numbers as the screen and the print: a row `Year`, then a header and one row per total.

| Column | Content |
| --- | --- |
| `Section` | `Firearm`, `Cartridge`, `Without a load`, `Month`, `Competition` or `Total`. |
| `Name` | The firearm's or cartridge's name, the month as `YYYY-MM`, or the competition event's day (`YYYY-MM-DD`) and name; empty for `Without a load`, for `Total` and for entries without a firearm or a known cartridge. |
| `Rounds` | Rounds fired (for a competition event, of the year's entries that link it); empty for a month. |
| `Entries` | Entries; empty for `Without a load`. |
