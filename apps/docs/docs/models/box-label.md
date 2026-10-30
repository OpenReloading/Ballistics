---
title: Box label of a saved load
description: The printed label for a box of loaded rounds, its values, its size and the text of its QR code, which names the load and nothing else.
---

# Box label of a saved load

The Saved loads drawer of the workbench prints a label for a box of loaded rounds from a saved load (the print button of the load's row, "Print a box label"). The label is made from the stored record alone, so the same saved load always gives the same label. Nothing new is stored, nothing is sent: the names of the records the load refers to are read from this browser and the data files, as the CSV export of the saved loads reads them.

## What the label prints

One label of 90 x 60 mm at the top left of an A4 page, with a dashed edge to cut along: the name across the top, the values left and the QR code right. In the language shown:

- the load's name;
- cartridge, bullet, powder and charge, primer;
- the seating length as stored: COAL, or CBTO for a load seated by base to ogive (the other length is not derived);
- the day the load was saved (`YYYY-MM-DD`), not the day of printing, so a reprint is the same label (saving the load again changes it);
- the powder, primer and case lots, each only when it is typed on the load;
- the QR code and, under it, its text in small type.

A field the load does not hold is left out. A record whose name cannot be read prints its reference as stored.

Code: `apps/web/src/lib/box-label.ts` (`boxLabel`, `labelPayload`), `apps/web/src/components/box-label.tsx`.

## QR text

```text
OR1:L:<record id>
```

| Part | Meaning |
| --- | --- |
| `OR` | This project's labels |
| `1` | Format version of the text |
| `L` | Kind of record: a saved load |
| `<record id>` | The id of the load's user record, a UUID |

The text names the load and holds none of its values, so a scan of an old label never disagrees with the load as it is stored now. A phone's reader shows it as plain text: the app has no link target for a load yet, since the records stay on the device and the static site has no accounts.

A later format may put the same text into a URL (for example as the fragment of an app address) so that a scan opens the load. A reader looks for `OR1:L:` in the scanned text and takes the id after it; a text with another version number is not read as this format. A new kind of record gets its own letter.

The code is QR model 2 with error correction level M (about 15 % of the code may be lost) and the 4-module quiet zone, version 3 (29 by 29 modules) for a UUID. At 22 mm one module is about 0.6 mm. The matrix comes from the MIT-licensed `uqr` package, loaded with the label on the first print only.

## Limits

- The label shows the load as saved. Edits not yet saved in a tab are not on it.
- The QR code identifies a load of one browser. Another browser or device finds it only after the load was exported there.
- One label per print. A sheet of several labels is not offered.
- A label is bookkeeping. It says nothing about whether a load is fit for use; the results of this project are simulations, not load data.

## Sources

The matrix is encoded by [`uqr`](https://github.com/unjs/uqr); a test decodes it with an independent reader. The text format, the error correction level and the size are this project's choice. The decision for the label is recorded in the research log entry on [lot and batch traceability](../research/lot-batch-traceability.md).
