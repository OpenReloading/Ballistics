---
title: Burn laws and form functions
description: Pressure-dependent burn laws of the M3 interior model, the form functions of geometric grains and of vivacity forms, and the dynamic vivacity.
---

# Burn laws and form functions

The burn law gives the rate at which the charge of the [M3 interior model](interior-m3.md) burns at the current mean pressure.

- Geometric law: the regression rate of the grain surface. The grain shape turns the burnt depth into a burnt fraction.
- Vivacity law: the rate of the burnt fraction itself, with a form function for the burning surface relative to the initial one.

For one law, `burnForm` returns the burnt fraction as a function of the integrated form variable $f$, the factor on its rate, the breakpoints and the value of $f$ at burnout. The dynamic vivacity expresses a vivacity law as a burn rate per pressure.

## Equations

### Burn laws

Geometric law: every surface of the grain recedes at the same rate, the burnt depth $y$ is scaled by the half web $e_1$, and the burnt fraction is $z = Z(f)$:

$$
\frac{dy}{dt} = \beta\, \tau_T\, \bar p^{\,n}, \qquad f = \frac{y}{e_1}, \qquad \frac{df}{dt} = \frac{\beta\, \tau_T\, \max(\bar p, 0)^{n}}{e_1}
$$

Code: `packages/core/src/interior/model.ts`, `scaleInteriorLoad` (`coef`), `interiorRhs`.

Vivacity law: the burnt fraction itself is the state ($f = z$, except in the third stage of the three-stage form):

$$
\frac{dz}{dt} = B_a\, \tau_T\, \varphi(z) \left(\frac{\max(\bar p, 0)}{p_\text{ref}}\right)^{n}
$$

Code: `packages/core/src/interior/model.ts`, `scaleInteriorLoad` (`coef`), `interiorRhs`.

$\tau_T$ is the temperature factor of the [M3 model](interior-m3.md). Burning stops at $f = f_\text{end}$ ($z = 1$), a terminal event of the integration, after which $df/dt = 0$.

### Geometric grains

$Z(f)$ is the burnt volume fraction of one grain, $\varphi = 1$ on the rate.

Sphere of diameter $D$, $e_1 = D/2$, $f_\text{end} = 1$:

$$
Z(f) = 1 - (1 - f)^3
$$

Code: `packages/core/src/interior/form.ts`, `grainShapes` (`sphere`).

Cylinder of diameter $D$ and length $L$, $e_1 = \min(D, L)/2$, $f_\text{end} = 1$:

$$
Z(f) = 1 - \left(1 - \frac{2 e_1 f}{D}\right)^2 \left(1 - \frac{2 e_1 f}{L}\right)
$$

Code: `packages/core/src/interior/form.ts`, `grainShapes` (`cylinder`).

Tube of outer diameter $D$, perforation $d_p$ and length $L$, web $w = (D - d_p)/2$, $e_1 = w/2$, $f_\text{end} = 1$:

$$
Z(f) = 1 - (1 - f)\left(1 - \frac{w f}{L}\right)
$$

Code: `packages/core/src/interior/form.ts`, `grainShapes` (`tube`).

Seven-perforated grain of outer diameter $D$, perforation $d_p$ and length $L$: one perforation at the centre and six on a hexagon of centre spacing $s$, with a uniform web $w$. With the burnt depth $y = e_1 f$ and the initial cross-section $A_0$:

$$
w = \frac{D - 3 d_p}{4}, \qquad e_1 = \frac{w}{2}, \qquad s = d_p + w, \qquad A_0 = \frac{\pi}{4}\left(D^2 - 7 d_p^2\right)
$$

Code: `packages/core/src/interior/form.ts`, `sevenPerf`.

Web phase, $0 \le f \le 1$: a cylinder of diameter $D - 2y$ less seven perforations of diameter $d_p + 2y$, of length $L - 2y$:

$$
Z(f) = 1 - \frac{\left((D - 2y)^2 - 7 (d_p + 2y)^2\right)(L - 2y)}{\left(D^2 - 7 d_p^2\right) L}
$$

Code: `packages/core/src/interior/form.ts`, `sevenPerf` (`area`).

At $f = 1$ the perforation circles touch each other and the outer surface, and twelve slivers remain. Sliver phase, $1 \lt f \le f_s$, with perforation radius $\varrho = d_p/2 + y$ and outer radius $R = D/2 - y$. Half the overlap of two perforation circles at centre spacing $s$:

$$
\ell(\varrho) = \varrho^2 \arccos\frac{s}{2\varrho} - \frac{s}{2}\sqrt{\varrho^2 - \frac{s^2}{4}}
$$

Code: `packages/core/src/interior/form.ts`, `sliverArea` (`halfLens`).

Six inner slivers, each in the triangle of the centre and two neighbouring outer perforation centres, until the three circles meet at $\varrho = s/\sqrt{3}$:

$$
A_\text{in} = \frac{\sqrt{3}}{4} s^2 - \frac{\pi}{2}\varrho^2 + 3\,\ell(\varrho)
$$

Code: `packages/core/src/interior/form.ts`, `sliverArea` (`inner`).

Six outer slivers, each in the 60 degree sector of the outer circle between two neighbouring outer perforation centres and outside that triangle, with $\Lambda$ the overlap of the outer circle with one outer perforation circle:

$$
A_\text{out} = \frac{\pi}{6} R^2 - \frac{\sqrt{3}}{4} s^2 - \Lambda(R, \varrho, s) + \frac{\pi}{3}\varrho^2 + \ell(\varrho)
$$

Code: `packages/core/src/interior/form.ts`, `sliverArea` (`outer`, `lensArea`).

Overlap area of two disks of radii $r_1$, $r_2$ at centre distance $c$ (0 when they do not meet, the smaller disk when one holds the other):

$$
\Lambda = r_1^2 \alpha_1 + r_2^2 \alpha_2 - \tfrac{1}{2}\sqrt{(r_1 + r_2 - c)(c + r_1 - r_2)(c - r_1 + r_2)(c + r_1 + r_2)}, \qquad \alpha_1 = \arccos\frac{c^2 + r_1^2 - r_2^2}{2 c r_1}, \qquad \alpha_2 = \arccos\frac{c^2 + r_2^2 - r_1^2}{2 c r_2}
$$

Code: `packages/core/src/interior/form.ts`, `lensArea`.

Burnt fraction in the sliver phase:

$$
Z(f) = 1 - \frac{6\left(A_\text{in} + A_\text{out}\right)(L - 2y)}{A_0 L}
$$

Code: `packages/core/src/interior/form.ts`, `sevenPerf` (`area`).

The outer slivers vanish when the outer intersection of two perforation circles reaches the outer surface. That depth gives $f_s$, found once by bisection:

$$
\frac{\sqrt{3}}{2} s + \sqrt{\varrho^2 - \frac{s^2}{4}} = R
$$

Code: `packages/core/src/interior/form.ts`, `sevenPerf` (`yEnd`).

The slope of $Z$ changes at $f = 1$ and where the inner slivers vanish. Both are breakpoints of the integration:

$$
f_i = 1 + \frac{2 s}{w}\left(\frac{1}{\sqrt{3}} - \frac{1}{2}\right)
$$

Code: `packages/core/src/interior/form.ts`, `sevenPerf` (`breaks`).

The sliver phase, $f_i$ and $f_s$ follow from plane geometry worked out for this model, not from a source.

### Vivacity forms

Constant form:

$$
\varphi(z) = 1
$$

Code: `packages/core/src/interior/form.ts`, `vivacityForms` (`constant`).

Two-stage form, continuous at $z_1$: a first stage that is progressive, neutral or degressive by the sign of $a$, and a degressive second stage:

$$
\varphi(z) = \begin{cases} (1 + a z)^{m} & z \le z_1 \\ \varphi_1 \left(\dfrac{1 - z}{1 - z_1}\right)^{q} & z_1 \lt z \le 1 \end{cases}, \qquad \varphi_1 = (1 + a z_1)^{m}
$$

Code: `packages/core/src/interior/form.ts`, `vivacityForms` (`twoStage`, `phi1`).

$z_1 \lt 1$ is a breakpoint. Beyond $z = 1$ the factor is 0 for $z_1 \lt 1$ and $q \gt 0$, and $\varphi_1$ otherwise, so an integration step may cross burnout.

Three-stage form, continuous at $z_1$ and $z_2$:

$$
\varphi(z) = \begin{cases} (1 + a z)^{m} & z \le z_1 \\ \varphi_1 \left(\dfrac{1 - z}{1 - z_1}\right)^{q} & z_1 \lt z \le z_2 \\ \varphi_2 \left(\dfrac{1 - z}{1 - z_2}\right)^{r} & z_2 \lt z \le 1 \end{cases}, \qquad \varphi_2 = \varphi_1 \left(\frac{1 - z_2}{1 - z_1}\right)^{q}
$$

Code: `packages/core/src/interior/form.ts`, `vivacityForms` (`threeStage`, `phi2`).

For $0 \lt r \lt 1$ the third stage reaches $z = 1$ as a power of the time left, and $1 - z$ falls below double precision before burnout. The third stage is therefore integrated in a variable whose rate has the constant factor $\varphi_2$, so burnout is a linear crossing of $f_\text{end}$:

$$
f = z_2 + (1 - z_2)\, \frac{1 - w_z^{\,1 - r}}{1 - r}, \qquad w_z = \frac{1 - z}{1 - z_2}, \qquad f_\text{end} = z_2 + \frac{1 - z_2}{1 - r}
$$

Code: `packages/core/src/interior/form.ts`, `vivacityForms` (`threeStage`, `k`, `u`).

Its inverse, continued smoothly beyond $f_\text{end}$:

$$
Z(f) = 1 - (1 - z_2)\, \operatorname{sgn}(u)\, \lvert u \rvert^{1/(1 - r)}, \qquad u = 1 - (1 - r)\, \frac{f - z_2}{1 - z_2}
$$

Code: `packages/core/src/interior/form.ts`, `vivacityForms` (`threeStage`, `u`).

Below $z_2$, $f = z$. With $r = 0$, $f = z$ throughout. With $r = q$ the form equals the two-stage form with the same $a$, $m$, $q$, $z_1$.

The change of variable in the third stage is a choice of the model.

### Dynamic vivacity

Burn rate per pressure of a vivacity law with exponent $n = 1$ and temperature factor 1:

$$
L_d(z) = \frac{1}{\bar p} \frac{dz}{dt} = \frac{B_a\, \varphi(z)}{p_\text{ref}}
$$

Code: `packages/core/src/interior/vivacity.ts`, `dynamicVivacity`.

Mean dynamic vivacity over burnt fraction 0.1 to 0.9, by Simpson's rule with 64 intervals on each piece between the breakpoints of the form:

$$
\bar L_d = \frac{1}{z_b - z_a} \int_{z_a}^{z_b} L_d(z)\, dz, \qquad z_a = 0.1, \quad z_b = 0.9
$$

Code: `packages/core/src/interior/vivacity.ts`, `meanDynamicVivacity`.

The range 0.1 to 0.9 and the 64 intervals of $\bar L_d$ are choices of the model.

`dynamicVivacity` rejects an exponent other than 1, because the rate per pressure then depends on the pressure. The constant and two-stage forms are accepted. The type of its argument excludes the three-stage form, because its third stage is integrated in another variable.

$L_d$ is not the quantity read from a measured closed-vessel curve, $L = \dot p / (\bar p\, p_\text{max})$. With the Noble-Abel pressure of the closed vessel, $\bar p = \Phi z / (1 + \chi z)$ at normalised charge density $D = m_c / (V_c \rho_s)$ and $\chi = (1 - \eta \rho_s) D / (1 - D)$, the two differ by a factor that depends on $z$ and on the loading density, $L(z) = L_d(z)\,(1 + \chi)/(1 + \chi z)^2$. The factor is 1 only for $\chi = 0$. For the demo powder ($\eta = 0.97 \cdot 10^{-3}$ m³/kg, $\rho_s = 1600$ kg/m³) it runs from 0.86 at $z = 0$ to 1.16 at $z = 1$ at $D = 0.2$, and from 0.45 to 2.23 at $D = 0.5$, a cartridge-like loading density. Every vivacity, $B_a$ and $\bar L_d$ of this page and of the powder records uses the definition $L_d$. A closed-vessel vivacity taken from elsewhere is converted with the factor before it is compared ([burn law checks](../research/interior-burn-law-checks.md)).

The burn law checks keep the pressure exponent at $n = 1$. The laws accept another exponent, and `fitPressureCurves` fits it by default ([curve fit](interior-curve-fit.md)). With a fixed form function, the integral of $\bar p^n$ over a common range of burnt fraction is the same for every charge of one powder. A closed vessel ignites at a burnt fraction $z_0$ that depends on the loading density, so the range starts above the $z_0$ of every curve, not at ignition. Closed-vessel curves of one powder at four or more loading densities would show the exponent at which that integral varies least. The data has no such curves ([burn law checks](../research/interior-burn-law-checks.md)).

## Symbols

| Symbol | Meaning | Stored unit | Unit in `core` |
| --- | --- | --- | --- |
| $y$ | Burnt depth from each surface | mm | m |
| $e_1$ | Half web | mm | m |
| $f$, $f_\text{end}$ | Form variable, its value at burnout | 1 | 1 |
| $f_i$, $f_s$ | Seven-perforated grain: end of the inner slivers, burnout | 1 | 1 |
| $z$ | Burnt fraction of the charge | 1 | 1 |
| $Z(f)$ | Burnt fraction as a function of $f$ | 1 | 1 |
| $\beta$ | Burn-rate coefficient | no kind | m s^-1 Pa^-n |
| $n$ | Pressure exponent | 1 | 1 |
| $\bar p$ | Mean pressure | bar | Pa |
| $p_\text{ref}$ | Reference pressure of the vivacity law | bar | Pa |
| $B_a$ | Vivacity | 1/s | 1/s |
| $\varphi$ | Form function, burning surface over initial surface | 1 | 1 |
| $\varphi_1$, $\varphi_2$ | Form function at $z_1$ and at $z_2$ | 1 | 1 |
| $a$, $m$, $q$, $r$ | Form parameters | 1 | 1 |
| $z_1$, $z_2$ | Stage boundaries in burnt fraction | 1 | 1 |
| $\tau_T$ | Temperature factor on the burn rate | 1 | 1 |
| $D$, $d_p$, $L$ | Grain diameter, perforation diameter, grain length | mm | m |
| $w$ | Web | mm | m |
| $s$ | Centre spacing of the perforations | mm | m |
| $\varrho$, $R$ | Perforation radius and outer radius during the sliver phase | mm | m |
| $A_0$, $A_\text{in}$, $A_\text{out}$ | Initial cross-section, area of one inner and one outer sliver | mm2 | m2 |
| $\ell$, $\Lambda$ | Half overlap of two perforation circles, overlap of two disks | mm2 | m2 |
| $L_d$, $\bar L_d$ | Dynamic vivacity, its mean over $z_a$ to $z_b$ | no kind | 1/(Pa s) |

## Assumptions

- Every surface of a grain burns at the same rate, and all grains of a charge are equal.
- The mean pressure drives burning.
- The seven-perforated grain has a uniform web: inner and outer webs are equal.
- The vivacity forms are fitted shapes. No cited source gives values of $a$, $m$, $q$, $z_1$, $z_2$, $r$ for a real powder.
- The first stage $(1 + a z)^m$ of the vivacity forms is a choice of the model. The later stages are pieces of the form $\alpha (1 - z)^{n}$ with $\alpha$ set for continuity.

## Limits

- Valid input of the geometric law: $\beta \gt 0$, $n \ge 0$, all grain dimensions positive. Tube: $d_p \lt D$ and $L \ge w$. Seven-perforated grain: $3 d_p \lt D$ and $L$ longer than twice the burnt depth at $f_s$.
- Valid input of the vivacity law: $B_a \gt 0$, $p_\text{ref} \gt 0$, $n \ge 0$.
- Valid input of the two-stage form: finite values, $0 \lt z_1 \le 1$, $1 + a z_1 \gt 0$, $q \ge 0$, and $q \lt 1$ when $z_1 \lt 1$. With $q \ge 1$ the charge reaches $z = 1$ only asymptotically.
- Valid input of the three-stage form: finite values, $0 \lt z_1 \lt z_2 \lt 1$, $1 + a z_1 \gt 0$, $q \ge 0$ and $0 \le r \lt 1$. With $r \ge 1$ the charge never burns out.
- Code: `packages/core/src/interior/form.ts`, `burnError`. An invalid law gives the invalid reason `input` with the field name.
- Grains with different inner and outer webs, deterrent coatings that change the burn rate with depth, and a spread of grain sizes are not modelled. The parameter $a$ of the two-stage form is the only proxy for a coating: the first stage is degressive when $a m \lt 0$, constant when $a m = 0$ and progressive when $a m \gt 0$. The powder records hold no coating, so the effect of a coating was not measured ([burn law checks](../research/interior-burn-law-checks.md)).
- Deterrent coatings: for a deterred ball powder with a measured penetration depth of 0.056 mm, the burn coefficient of the deterred layer is about 0.35 to 0.45 of the undeterred one by three burn laws (ratios of the published coefficients, [Micković 2010](../bibliography.md#mickovic-2010)). A coated layer needs the grain diameter and the penetration depth, which are not fields of a powder record.
- The two-stage and three-stage forms do not reproduce the infinite slope of the surface after the web of a seven-perforated grain burns through. The geometric form has it.
- Research log: [fitted parameters of the load-table fit](../research/interior-load-table-fit-parameters.md) (the form parameter is not identified from velocities).

## Sources

- [Kneubuehl 2018](../bibliography.md#kneubuehl-2018), p. 70 eq. (3.3:14): burn law with a pressure exponent (Vieille's law).
- [Kneubuehl 2018](../bibliography.md#kneubuehl-2018), p. 75 eqs. (3.3:24) and (3.3:25): vivacity form of the burn law.
- [Kneubuehl 2018](../bibliography.md#kneubuehl-2018), p. 72 eqs. (3.3:21) and (3.3:22): form functions of the sphere and the long cylinder.
- [Kneubuehl 2018](../bibliography.md#kneubuehl-2018), p. 106 eqs. (3.5:9) and (3.5:10): dynamic vivacity.
- [Kneubuehl 2018](../bibliography.md#kneubuehl-2018), p. 73 Table 3.5: form functions of the cylinder of finite length, the tube and the seven-perforated grain in parameter form, and the degressive burning of slivers.
- [Kneubuehl 2018](../bibliography.md#kneubuehl-2018), p. 74 eq. (3.3:23): piecewise form function from pieces $\alpha (1 - z)^n$.
