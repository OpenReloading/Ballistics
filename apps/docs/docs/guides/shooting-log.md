---
title: Shooting log
description: The range days of the shooting log (Schießbuch) in the web app, how their rounds reach a firearm's round count, and the columns of its print, CSV and JSON.
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
| Confirmed by, Confirmed on | Who confirmed the entry, as you type it, and the day. |
| Notes | Plain text. |

The record is a user record of kind `shootingLogEntry` ([Glossary](https://github.com/OpenReloading/Ballistics/blob/main/GLOSSARY.md)). An app version without this kind skips such records when it opens a file and says how many it skipped.

## Round count

Saving an entry with a firearm that has a round count asks once whether to add the entry's rounds to it. Only a yes changes the count; No leaves it as it was. The firearm notes the rounds it took from the entry, so saving the entry again asks only about rounds added since. A firearm without a round count is not changed: set a count on the Firearms page first. The shooting log keeps no second total: the firearm's round count is the one counter.

## Filters, print and export

The firearm and year filters are kept in the address; From and To narrow the entries to a day range. Print, Export CSV and Export JSON take the entries the filters show.

- **Print** gives one line per entry with a blank Signature column for the club's confirmation, the period the filters name, and the number of entries and rounds.
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

- **Export JSON** writes `openreloading-shooting-log-<day>.json`, a user data file with the entries. **Import JSON** reads it back: new entries are added, equal ones left, and entries that differ from the browser's are replaced after one question. The firearms and loads the entries name are not in the file; in another browser their names show as not in this browser.
