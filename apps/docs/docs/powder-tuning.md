---
title: Tuning a powder from chronograph strings
description: Steps from chronograph strings on the Measurements tab to a fitted powder saved in the browser, the notes and refusals the tuning screen shows, and how to refit later.
---

# Tuning a powder from chronograph strings

The tuning screen fits the burn coefficient of the load's powder (and, where the strings allow, more values) so that the simulated muzzle velocity matches your chronograph strings, and saves the result as a powder of your own. All values are simulations, not load data. The rules of the fit are on the model page [Powder fit from a chronograph ladder](models/interior-powder-fit.md).

You need a saved load in the [Load workbench](https://openreloading.github.io/Ballistics/workbench/) and chronograph strings fired with it at two or more charges. Nothing you enter leaves your browser.

## Steps

1. **Record the strings.** Open the load in the workbench and set a charge ladder that holds the charges you fired. Run it, open the Measurements tab and read your chronograph files under Chronograph files, one series each. Under Strings and charges, map each string to its ladder step; leave a string you do not want on Not used. Save the load: the tuning screen fits only strings of a saved load.
2. **Note the powder temperature.** A string fitted from the Measurements tab has the powder temperature its session records, or else the load's Powder temperature. For strings fired at another temperature, type them on the tuning screen instead (step 3).
3. **Open the tuning screen.** Follow Fit a powder from these strings on the Measurements tab. The screen lists the strings, one row each (charge, powder temperature where it differs from the load's, shots, mean and SD), and fits at once. To add a string by hand, type its Charge, Shot velocities separated by spaces and, if it differs from the load's, Temperature under the table, then Add a string; a field that does not read says why. A string added here has Remove, and Undo brings it back. From a powder record (Tune from strings) or a powder of your own in the powder designer (Fit a powder from chronograph strings), the screen lists the saved loads that use the powder; opened without one, its Powder select offers the powders of your saved loads with strings.
4. **Read the fit and its band.** The Fitted values table gives each fitted value with its unit, start value, standard uncertainty and interval. The strings table adds the simulated velocity and the residual of each string. From 64em the chart stays beside the controls while you scroll. The chart draws the fitted curve and its band, and the lines below it give the band's velocity and interval at the ends of the drawn range, below, inside or above the fired charges. Pressure range gives the peak-pressure range the fixed inputs add, with a label (tight, moderate or loose) and its reasons under Because. The label describes the width of the simulation's range, not a load.
5. **Tune by hand (optional).** Under Hand tuning each fitted value has a slider of 3 standard uncertainties either side of the fitted value, with the values at its ends, a tick at the fit and the distance from the fit in standard uncertainties. The sliders move the shown values and the curve; the band and the pressure range stay those of the fit. Back to the fit returns to the fitted values.
6. **Save as a powder.** Give a Powder name and choose Save as a powder. The record holds the fitted values, never the hand-tuned ones, and the strings it was fitted from. The Powder search of the workbench then lists it as your design; choose it in the load to simulate with it. To use hand-tuned values, type them on the workbench, where they are marked hand-tuned.
7. **Refit later.** Fire more strings with a load that uses your fitted powder, map them on the Measurements tab and open the tuning screen again. Saving makes a new record named "<name> (fit 2)", then 3 and on, so the loads on the earlier fit run as before.

## Exporting a powder

In the powder designer, the File menu's Save writes the powder as a user data file: the stored record, its `draft` (the powder fields entered so far) and, for a fitted powder, its `fit` block (the points, the confidence and its reasons). Open file or Import reads that file back unchanged, in this or another browser. Copy JSON copies the same record. A powder has no share link: send the file instead. There is no export of the built powder in the catalogue record format for a catalogue pull request. The file's fields are in [Fit of a user powder](data/record-model.md#fit-of-a-user-powder).

## Notes and refusals

The screen says when it fitted fewer values than it was asked for, or could not fit:

| What you see | Why | What to do |
| --- | --- | --- |
| Fewer than 3 charges, or charges less than 10 % apart: only the burn coefficient is fitted | Thin ladder: the other values stay at those of the similar powder | Add strings at charges further apart, or Try the other values anyway |
| The start pressure or the chamber volume move together with the burn coefficient: they are held | Held values: their correlation with the burn coefficient is above 0.9 | Add a measured pressure; until then only the burn coefficient is fitted |
| The temperature factor needs strings at two or more powder temperatures | All strings are at one temperature | Add strings at another powder temperature |
| The temperature factor cannot be told from the burn coefficient, it stays at 1 | The temperatures are too close | Add strings at temperatures further apart |
| The powder has no temperature sensitivity | A powder of your own without one, and strings at two or more temperatures | Type a Temperature sensitivity (1/K); the fit scales it, so any value above 0 starts it |
| Fewer charges than values, values that cannot be told apart, charges too close, a charge the model cannot run, or a fit that did not settle | The fit refused; the message names the cause and one action | Follow the message; a charge the model cannot run is highlighted in the strings table |
| A powder record holds at most 40 points, one per charge and powder temperature | Save refused: too many distinct charges and temperatures | Leave strings out on the Measurements tab (Not used) until 40 or fewer remain |
| Left out, the strings of another load | The sessions hold strings of more than one load | Only the strings of the load you opened are fitted |

The rules behind each note are in [Powder fit from a chronograph ladder](models/interior-powder-fit.md#several-barrel-lengths-and-temperatures), its failures in [Failures](models/interior-powder-fit.md#failures) and the label in [Confidence label](models/interior-powder-fit.md#confidence-label).

The fitted values describe your rifle, the powder lot and the temperatures of your sessions. They are simulation parameters, not load data, and not a property of the powder to carry to another rifle or load.
