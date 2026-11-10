---

title: Chambrage in the pressure gradient
description: Whether a chambrage form of the pressure gradient, for a case body wider than the bore, belongs in the interior model, and how much it moves a rifle load.
---

# Chambrage in the pressure gradient

## Question

Interior ballistics, pressure gradient: does a chambrage form of the gradient, for a chamber wider than the bore, belong in the M3 model?

## Method

Derive the gradient from the Lagrange assumptions (uniform gas density behind the projectile, density kept uniform as the gas moves) for a cylindrical chamber of area $\chi A$ followed by the bore of area $A$. Check the derivation two ways: the equation of motion from the energy balance against the one from the volume mean of the pressure field, and $\chi = 1$ against the present model. Integrate the equations independently of the model's code (fixed-step Runge-Kutta of fourth order, step 4e-9 s, events by bisection) on one synthetic rifle load and compare. Accept rule, set in advance: the model with `chamber.area` matches the independent integration to a relative 1e-6 on muzzle velocity, the three peak pressures, the muzzle breech pressure and the gas kinetic energy, and every result without `chamber.area` stays bit-identical.

## Formulas

In the symbols of the [M3 model page](../models/interior-m3.md#chambrage), with $g = 1 - 1/\chi^2$, $V = V_0 + A x$ and $f = V_0 / V$:

$$
\delta(x) = \tfrac{1}{3}\left(1 - g f^3\right), \qquad \varepsilon(x) = \tfrac{1}{2}\left(1 - g f^2\right), \qquad m_e(x) = m_p' + \delta(x)\, m_c
$$

$$
m_e(x)\, a = A \bar p - F_r - \tfrac{1}{2} m_c\, g f^3 \frac{A}{V} v^2, \qquad p_b = \frac{m_p' a + F_r}{A}, \qquad p_\text{br} = p_b + \varepsilon(x)\, \frac{m_c a}{A} + \frac{m_c}{2V}\, g f^2 v^2
$$

The gas speeds up from $f v / \chi$ to $f v$ at the step into the bore, which gives the Bernoulli term of the breech pressure. The extra term of the motion is $\tfrac{1}{2} m_c (d\delta/dx)\, v^2$, so $\tfrac{d}{dt}\left(\tfrac{1}{2} m_e v^2\right) = v (A \bar p - F_r)$. The derivation is this project's own; it was not compared with a published chambrage gradient (unverified).

## Numbers

Synthetic load: $V_0$ = 3.6 cm³, $A$ = 47.6 mm², chamber body 119 mm² ($\chi$ = 2.5), 550 mm travel, 10.8 g bullet without twist, 2.8 g charge, $Q$ = 3.9 MJ/kg, $k$ = 1.24, $\rho_s$ = 1600 kg/m³, $\eta$ = 1 cm³/g, vivacity 0.55 1/s at 1 bar with exponent 1 and constant form, $p_i$ = 5 MPa, $p_\text{st}$ = 30 MPa, no resistance, heat loss or leakage.

| Simulated value      | Lagrange  | Chambrage, $\chi$ = 2.5 | Change |
| -------------------- | --------- | ----------------------- | ------ |
| Muzzle velocity      | 797.8 m/s | 787.2 m/s               | −1.3 % |
| Peak breech pressure | 278.8 MPa | 262.5 MPa               | −5.9 % |

The independent integration gives 787.162323 m/s, peak breech 262.522077 MPa, peak base 236.232459 MPa, peak mean 256.063051 MPa, muzzle breech 67.6094451 MPa and a gas kinetic energy of 288.729021 J at the muzzle; the model matches each to a relative 2e-9 or better. With $\chi$ = 1 the integration matches the present model to 2e-9. The burn coefficient is the same in both columns; a refit would take back part of the change.

## Result

No change for record runs. Adopted as an option of the load, `chamber.area`, not the default: adoption for record runs needs a held-out comparison in which each form refits its burn coefficients.

## Data basis

Analytic: a derivation and a synthetic load, no measured pressure or velocity.

## Where in the app

- `packages/ballistics/src/interior/model.ts`, `chambrageOf`.
- `packages/use-cases/src/interior-schema.ts`, `chamber.area` of the API's load.
- Model page: [M3 interior model](../models/interior-m3.md#chambrage).

## Confidence

Medium for the derivation, as two routes give the same equation of motion and the energy balance closes; low for the benefit on real loads, which is not measured.
