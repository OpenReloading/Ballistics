---
title: Start pressure of a powder model fitted without one
description: Which default start pressure the workbench gives a powder model fitted at the rifle assumption, and a handgun bullet without a construction.
---

# Start pressure of a powder model fitted without one

## Question

M3 shot start: should the workbench run a powder model fitted without a start pressure of its own at the start pressure of its fit, rather than at the rule by bullet construction, and which default does a handgun bullet without a construction get (#944, #945)?

## Method

- **Compared.** The default of the start pressure field and of the Powders tab rows after #852 against the start pressure each powder record was fitted at, as its `interior` source notes state it, and against `defaultStartPressure` in core.
- **Data.** The 224 powder records with a model in `packages/data/records/powders`; the fitted values of the [start pressure rules](./interior-start-pressure-rules.md).
- **Accept rule** (decided before the change, the recommendation of #944). A model parameter runs at the conditions of its fit: a rifle run of a powder model fitted without a start pressure takes the value of its fit; the workbench and core give a handgun without a construction the same value.

## Formulas

None new. Shot start as on the [M3 model](../models/interior-m3.md) page, "Shot start": the bullet moves once the base pressure exceeds $p_\text{st}$.

## Numbers

- Powder records with a model: 224, none with its own `interior.startPressure`. Each source note says the fit ran at `defaultStartPressure` per row: 30.0 MPa at a barrel of 300 mm and longer, by the printed bullet construction below.
- After #852 a rifle run of such a powder took the rule by construction: monolithic 35.3, jacketed 29.2, lead 30.0 MPa, against the 30.0 MPa of its fit. On a .308 168 gr stand-in at a full charge, 35.3 MPa moved the peak pressure by +2.5 % ([start pressure rules](./interior-start-pressure-rules.md)). With this change it runs at 30.0 MPa again: 0 % from its fit.
- Handgun bullet record without `construction`: 30.0 MPa (the rifle assumption) before, 30.8 MPa (jacketed handgun, 95 % interval 21.2 to 40.6 MPa) after, +2.7 % in the input, the value `defaultStartPressure` and the fit give it.

## Result

Improved: adopted. In a barrel of 300 mm or longer the start pressure field of a powder model without its own start pressure keeps 30 MPa and names it as the value of the fit; the rule by construction reaches a rifle only with a model typed by hand. A handgun bullet without a construction counts as jacketed, assumed. The structure table is one (`bulletStructures`), with the density class of the bullet volume below the mouth beside the construction; swaged stays of unknown density, since the cast class was measured on cast bullets only. A refit of the powder records at the rule by construction (#944, option b) is not done.

## Data basis

Analytic: the stated fit conditions of the powder records and the fitted values of the start pressure study.

## Where in the app

- `packages/core/src/interior/start-pressure.ts` (`bulletStructures`, `constructionOf`, `startPressureOf`).
- `apps/web/src/lib/start-pressure.ts` (`startPressureDefault`).
- `apps/web/src/lib/powder-compare.ts` (`fittedAtDefaultStart`, `powderValues`).
- `apps/web/src/lib/bullet-construction.ts` (`classOf`).
- Model pages: [M3 model](../models/interior-m3.md), [case capacity](../models/case-capacity.md).

## Confidence

High: the change restores the stated conditions of the fit; it does not say whether the rule by construction would fit better after a refit.
