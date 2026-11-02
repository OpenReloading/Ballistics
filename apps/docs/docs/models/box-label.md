---
title: Box label of a saved load
description: The printed label for a box of loaded rounds, its values, its size and the text of its QR code, which names the load and nothing else.
---

# Box label of a saved load

The Saved loads drawer of the workbench prints a box label from a saved load (the print button of the load's row, "Print a box label"). The label is made from the stored record alone, so the same saved load gives the same label as long as the names of the records it refers to, the unit system and the language stay the same. Nothing new is stored, nothing is sent: the names of the records the load refers to are read from this browser and the data files, as the CSV export of the saved loads reads them.

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

The text names the load and holds none of its values, so a scan of an old label never disagrees with the load as it is stored now. A phone's own reader shows it as plain text: the label carries no web address, since the records stay on the device and the static site has no accounts.

A reader looks for `OR1:L:` anywhere in the scanned text, also inside a web address, and takes the id after it; a text with another version number or another kind letter is not read as this format. A new kind of record gets its own letter.

## Reading a label

"Scan box label" in the Saved loads drawer and in the workbench's Ctrl+K search opens the reader. It offers three ways to a load:

- a photo, taken or chosen from the library, read in this browser for its code; the photo is not uploaded or kept. It is read with its orientation applied, at most 1280 px on its long side, and once more at its middle half when no code is found;
- the live camera, started by its button only: a few frames a second are read until a label is found; the camera stops on success, on error and when the dialog closes;
- the text printed under the code, or the load's id alone, typed and confirmed with Enter.

The id must name a saved load of this browser. A load opens in its own tab, or that tab is shown when it is open. A load is found only in the browser and the edition (release or next) that saved it: in another one the reader says so and the load has to be exported there and imported here. A load stored in a format the app no longer reads is reported as saved but unreadable.

The code is decoded by the Apache-2.0-licensed [`jsqr`](https://github.com/cozmo/jsQR) package, loaded with the reader on first use.

Code: `apps/web/src/lib/box-label.ts` (`readLabel`, `labelledLoad`), `apps/web/src/lib/label-reader.ts`, `apps/web/src/components/scan-label-dialog.tsx`.

The code is QR model 2 with error correction level M (about 15 % of the code may be lost) and the 4-module quiet zone, version 3 (29 by 29 modules) for a UUID. At 22 mm one module is about 0.6 mm. The matrix comes from the MIT-licensed `uqr` package, loaded with the label on the first print only.

## Limits

- The label shows the load as saved. Edits not yet saved in a tab are not on it.
- One label per print. A sheet of several labels is not offered.
- A label is bookkeeping. It says nothing about whether a load is fit for use; the results of this project are simulations, not load data.

## Sources

The matrix is encoded by [`uqr`](https://github.com/unjs/uqr); a test decodes it with an independent reader. The text format, the error correction level and the size are this project's choice. The decision for the label is recorded in the research log entry on [lot and batch traceability](../research/lot-batch-traceability.md).
