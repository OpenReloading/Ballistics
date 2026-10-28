---
title: Sébert factor as one coefficient for the pressure gradient
description: Why one Sébert factor sets both pressure gradient coefficients, what the default Lagrange pair does instead, and what is not compared.
---

# Sébert factor as one coefficient for the pressure gradient

## Question

Interior ballistics, pressure gradient: should a user-given Sébert factor $s$ set both gradient coefficients to $s$ (so the mean pressure equals the breech pressure), or only the coefficient of the gas energy?

## Method

No comparison with measured pressures was run. The choice is a design decision of the [M3 model](../models/interior-m3.md), and this page records it. The checks that exist are tests of the two settings:

- the default Lagrange pair gives breech to base and mean to base pressure ratios of exactly $1 + m_c/(2 m_p')$ and $1 + m_c/(3 m_p')$ within $10^{-12}$ (without resistance);
- `interiorLoad` maps `sebert: 0.3` to a gradient with `energy` 0.3 and `breech` 0.3;
- all closed-form tests use $s = 0.5$.

## Formulas

With the acceleration $a$ of the projectile, the mean and breech pressures exceed the base pressure by the gas inertia:

$$
\bar p = p_b + \delta\, \frac{m_c a}{A}, \qquad p_\text{br} = p_b + \varepsilon\, \frac{m_c a}{A}
$$

Default (uniform gas column with linear velocity): $\delta = 1/3$, $\varepsilon = 1/2$. With a Sébert factor, $\delta = \varepsilon = s$, and the projectile and the gas move as one effective mass $m_p' + s\, m_c$ ([Kneubuehl 2018](../bibliography.md#kneubuehl-2018), p. 77 eq. (3.3:28)).

## Numbers

None measured. The effective mass is $m_e = m_p' + \delta\, m_c$: with $s = 1/2$ it is $m_p' + m_c/2$, with the default pair $m_p' + m_c/3$.

## Result

No change. Documented as a choice of the model, not taken from a source: setting $\varepsilon$ equal to the Sébert factor. Not adopted for the load file: a separate key for the breech coefficient. The core accepts two coefficients, and the load-file key sets both. Kept: the Lagrange pair as the default when no factor is given.

## Data basis

Analytic: a modelling choice with algebraic checks, no measured data.

## Where in the app

- `packages/core/src/interior/load-file.ts`, `interiorLoad`.
- `packages/core/src/interior/model.ts`, `lagrangeGradient`, `gasState`.
- `packages/core/test/interior-model.test.ts`, the test "Lagrange pressure ratios without resistance".
- `packages/core/test/interior-load-file.test.ts`, the test "maps the field values; an empty bore area is the circle of the bore diameter".
- Model page: [M3 interior model](../models/interior-m3.md).

## Confidence

Low: nothing in the repository compares a Sébert-factor run with a measured breech pressure, so the choice is a convenience and the size of the breech pressure error it can cause is unknown.
