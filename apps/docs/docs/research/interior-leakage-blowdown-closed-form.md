---
title: Gas leakage against the isentropic blowdown closed form
description: Whether the leak model reproduces the exact pressure decay and escaped mass of a fixed vessel that empties through a choked orifice.
---

# Gas leakage against the isentropic blowdown closed form

## Question

Interior ballistics, gas leakage: does `closedVessel` with a leak area reproduce the pressure decay and the escaped mass of a fixed vessel venting through a choked orifice, the one leak case with an exact solution?

## Method

A rifle chamber (volume $3.4 \cdot 10^{-6}$ m³, charge 0.0028 kg, specific energy $3.9 \cdot 10^{6}$ J/kg, $k = 1.23$, solid density 1600 kg/m³) with covolume 0 and a leak area of $3 \cdot 10^{-6}$ m² at back pressure 0 was started at a burnt fraction $z_0 = 1 - 10^{-9}$, so the rest burns away within 1 ms at a constant rate and the vessel then holds gas only. The pressure and the escaped mass over the curve were compared with the closed form. Accept limits, from the test: relative difference below $10^{-8}$ in pressure at every point, escaped mass within $10^{-8}$ of the initial gas mass, and a final pressure below 0.6 of the initial one (so the vessel loses a large part of its gas).

## Formulas

With back pressure 0 the flow is choked, with the flow factor $\Phi$ of the [leakage page](../models/interior-leakage-heat.md). A fixed vessel of volume $V$ with gas mass $m$ and no heat loss expands isentropically as it empties. Integrating the orifice relation $\dot m = -C_d A_\ell\, \Phi\, p/\sqrt{R T}$ along the adiabat (derived here, not taken from a source) gives, with $m_0$, $p_0$ and $T_0$ at the start:

$$
\frac{m}{m_0} = \left(1 + \frac{k - 1}{2}\,\frac{C_d A_\ell\, \Phi \sqrt{R T_0}}{V}\, t\right)^{-2/(k-1)}, \qquad \frac{p}{p_0} = \left(\frac{m}{m_0}\right)^{k}
$$

with $\sqrt{R T_0} = \sqrt{p_0 V / m_0}$ from the Noble-Abel state at zero covolume.

## Numbers

Pressure agrees within $10^{-8}$ relative at every curve point and the escaped mass within $10^{-8} m_0$. The final pressure is below 0.6 of the initial pressure.

## Result

No change. Mass balance, flow factor, enthalpy carried out and the adiabat are consistent with each other in the one case where they can be compared with an exact result. The check leaves the discharge coefficient at its default of 1, which is a choice of the model ([leakage and heat loss](../models/interior-leakage-heat.md)), so it tests the flow and the adiabat, not the value of $C_d$.

## Data basis

Analytic: a closed form compared with the model, no measured data.

## Where in the app

- `packages/core/src/interior/model.ts`, `closedVessel`, `leakFlowFactor`.
- `packages/core/test/interior-model.test.ts`, the test "choked blowdown of a fixed vessel follows the isentropic closed form".
- Model page: [gas leakage and heat loss](../models/interior-leakage-heat.md).

## Confidence

High for the choked, covolume-free case. A leak with a moving projectile, a covolume or a subsonic flow has no closed form, and a leak area has no measurement in the repository that would tie the model to a real barrel.
