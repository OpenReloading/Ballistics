---
title: Competition events
description: The competition events page of the web app, how it scores ring series and practical stages, how an event's rounds reach a firearm's round count, and the columns of its print, CSV and JSON.
---

# Competition events

The competition events page (**Competition events**, `/events`, linked from the shooting log) keeps the events you shot in this browser, each with your own scores and their totals. These are your own records, not official results (the organiser publishes those); the page says so on screen and in print.

## An event

| Field | What it holds |
| --- | --- |
| Name | As you type it; empty: the event type and the day. |
| Date | The day, required. |
| Event type | One of the event type records (IPSC Handgun, USPSA Handgun and PCC, DSB-Meisterschaft), each with its rule book. |
| Level | One of the event type's levels, lowest first. |
| Division | For hit-factor types: one of the type's divisions, optional. |
| Place, Discipline, Firearm, Load | Optional; the discipline from the catalogue, the firearm and load from your library. |
| Rounds fired | Optional; empty: the shots of the ring series, where every series lists them. |
| Result | Completed, Did not finish or Disqualified. A disqualified event has no total. |
| Notes | Plain text. |

The event type sets how the event is scored ([Competition scoring](../models/competition-scoring.md)):

- **Ring series** (DSB): each series holds its ring values ("10 9 10.5", tenths where the discipline scores them) or only its total, and may name a saved target sheet. The event total is the sum of the series.
- **Practical stages** (IPSC, USPSA): each stage holds its hits per zone (A, C, D, metal), misses, no-shoots, procedurals, time and power factor; the page shows its points and hit factor. Major is offered only in a division the type gives a major rating. Stage points need the best hit factor of all competitors, so the event total is the sum of the stage points you type from the official result, and it shows only when every stage has them.

The record is a user record of kind `event` ([Glossary](https://github.com/OpenReloading/Ballistics/blob/main/GLOSSARY.md)).

## Round count

Saving an event with a firearm that has a round count asks once whether to add the event's rounds to it, as a shooting log entry does ([Shooting log](shooting-log.md#round-count)).

## Print and export

With an event open, Print, Export CSV and Export JSON take that event; with none open, the list of events.

- **Print** of an open event gives its facts, one line per series or stage with its total or points and hit factor, and the event total.
- **Export CSV** writes `openreloading-events-<day>.csv`, UTF-8 with a byte order mark, one row per series or stage (an event without results has one row), the event's columns repeated on each:

| Column | Content |
| --- | --- |
| `Event` | The event's name. |
| `Date` | Day, `YYYY-MM-DD`. |
| `Place` | Text. |
| `Event type` | The event type's name. |
| `Level` | As the event type names it. |
| `Division` | As the event type names it; empty for ring events. |
| `Firearm`, `Load` | The names in this browser. |
| `State` | `completed`, `did-not-finish` or `disqualified`. |
| `Event total` | Rings, or the sum of the typed stage points; empty where there is none. |
| `Part` | `Series <n>`, or the stage's name. |
| `Shots` | Ring values of the series, separated by spaces. |
| `A`, `C`, `D`, `Metal` | Hits of the stage per zone. |
| `Misses`, `No-shoots`, `Procedurals` | Penalties of the stage. |
| `Time (s)` | Stage time. |
| `Power factor` | `major` or `minor`. |
| `Points` | Total of the series, or points of the stage after penalties. |
| `Hit factor` | Points per second, four decimals. |
| `Stage points` | As typed from the official result. |

A text a spreadsheet would read as a formula starts with an apostrophe.

- **Export JSON** writes `openreloading-events-<day>.json`, a user data file with the events. **Import JSON** reads it back: new events are added, equal ones left, and events that differ from the browser's are replaced after one question. The firearms, loads and target sheets the events name are not in the file.
