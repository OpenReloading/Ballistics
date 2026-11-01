---
title: Leakage and heat loss
description: Gas leakage past the projectile and convective heat loss to the bore in the M3 interior model.
---

# Leakage and heat loss

Two optional terms of the [M3 interior model](interior-m3.md):

- Gas leakage: propellant gas escapes past the projectile through a leak area that can change with travel, as in a worn bore or a projectile that does not seal. The gas takes its mass and its enthalpy with it, which lowers pressure and velocity.
- Convective heat loss: heat flows from the gas to the bore wall by a pipe-flow correlation.

Without `leakage` and with `heat` set to `none` (the default), both terms are 0 and the results of the model are unchanged.

## Equations

### Gas in the barrel

The gas still in the barrel is the burnt charge less the escaped gas. The covolume belongs to that gas only:

$$
m_g = m_c z - m_\ell, \qquad V_f = V_c + A x - \frac{m_c}{\rho_s}(1 - z) - \eta\, m_g
$$

Code: `packages/core/src/interior/model.ts`, `gasState` (`freeVolume`, `lostMass`).

The Noble-Abel equation of state gives the product of gas constant and temperature from the state alone, so leakage needs no flame temperature:

$$
R T = \frac{\bar p\, V_f}{m_g}
$$

Code: `packages/core/src/interior/model.ts`, `gasState` (`leakRates`, `rt`).

### Flow through the leak

Quasi-steady isentropic flow of a perfect gas through an orifice, from the reservoir at the projectile base pressure $p_b$ to the pressure $p_a$ ahead of the projectile:

$$
\dot m_\ell = C_d\, A_\ell(x)\, \frac{p_b}{\sqrt{R T}}\, \Phi_k\!\left(\frac{p_a}{p_b}\right)
$$

Code: `packages/core/src/interior/model.ts`, `gasState` (`leakRates`, `flow`), `profileAt`.

Flow factor, choked below the critical pressure ratio $r^\ast$, subsonic above it, 0 when the back pressure reaches the reservoir pressure:

$$
\Phi_k(r) = \begin{cases} \sqrt{k} \left(\dfrac{2}{k + 1}\right)^{\frac{k + 1}{2(k - 1)}} & r \le r^\ast \\ \sqrt{\dfrac{2k}{k - 1}\left(r^{2/k} - r^{(k + 1)/k}\right)} & r^\ast \lt r \lt 1 \\ 0 & r \ge 1 \end{cases}, \qquad r^\ast = \left(\frac{2}{k + 1}\right)^{\frac{k}{k - 1}}
$$

Code: `packages/core/src/interior/model.ts`, `leakFlowFactor`.

$\Phi_k$ and its slope are continuous at $r^\ast$. $A_\ell(x)$ is interpolated linearly between `{ travel, area }` points with increasing travel and is 0 before the first and after the last point. While the projectile is held, the area at travel 0 applies.

### Energy carried out

Each kilogram of escaping gas carries the specific enthalpy of the Noble-Abel gas at the mean state, including the covolume term:

$$
\frac{dE_\ell}{dt} = \dot m_\ell \left(\frac{k}{k - 1} R T + \eta\, \bar p\right)
$$

Code: `packages/core/src/interior/model.ts`, `gasState` (`leakRates`).

The energy balance of the M3 model gains the term $E_\ell$:

$$
\bar p = \frac{(k - 1)\left(m_c Q z - W_r - E_h - E_\ell - \tfrac{1}{2} m_e v^2\right)}{V_f}
$$

Code: `packages/core/src/interior/model.ts`, `gasState` (`pressure`, `leaked`).

With this enthalpy, the gas left behind expands along the Noble-Abel adiabat when nothing burns and no heat is lost:

$$
\bar p \left(\frac{V_f}{m_g}\right)^{k} = \text{constant}
$$

Code: `packages/core/src/interior/model.ts`, `gasState` (`pressure`, `leakRates`).

### Integration

The scaled state of the M3 model gains two components:

$$
Y = \left(f,\; \frac{x}{x_e},\; \frac{v}{v_r},\; \frac{W_r}{m_c Q},\; \frac{E_h}{m_c Q},\; \frac{m_\ell}{m_c},\; \frac{E_\ell}{m_c Q}\right)
$$

Code: `packages/core/src/interior/model.ts`, `gasState` (`leakRates`, `lostMass`).

The subsonic flow factor has an infinite slope at $r = 1$. The onset of flow is therefore located as an event, after which the integration restarts:

$$
g_\text{onset} = p_b - p_a, \quad \text{rising}
$$

Code: `packages/core/src/interior/model.ts`, `interiorEvents` (`onset`), `runInterior` (`leaking`).

The flow rate is 0 until the onset fires. Where $p_b \ge p_a$ at the start or at a restart, the flow begins there, because a rising event cannot fire. Points of the leak-area profile join the engraving points as events, and profile points at or beyond the muzzle travel are left out.

The load-file key `leakArea` sets a leak area that is constant from travel 0 to the muzzle. The back pressure defaults to the ICAO sea-level pressure and the discharge coefficient to 1.

The discharge coefficient of 1 is a choice of the model.

Code: `packages/core/src/interior/load-file.ts`, `interiorLoad` (`leakArea`).

### Convective heat loss

Gas constant from the force constant and the flame temperature, and the gas temperature from the equation of state:

$$
R = \frac{(k - 1)\, Q}{T_0}, \qquad T = \frac{\bar p\, V_f}{m_g R}
$$

Code: `packages/core/src/interior/model.ts`, `gasState` (`gasR`, `temperature`).

Heat flux to the bore surface behind the base, with the chamber taken as a bore-diameter cylinder of the same volume:

$$
\dot q = c_h\, h\, \pi d \left(x + \frac{V_c}{A}\right) (T - T_w)
$$

Code: `packages/core/src/interior/model.ts`, `gasState` (`heatFlux`).

Heat-transfer coefficient from the correlation for turbulent pipe flow (Dittus-Boelter form), with the mean gas speed $v/2$ of a velocity rising linearly from breech to base:

$$
h = 0.023\, \frac{\lambda_g}{d}\, \mathrm{Re}^{0.8}\, \mathrm{Pr}^{n_h}, \qquad n_h = \begin{cases} 0.3 & T \gt T_w \\ 0.4 & T \le T_w \end{cases}
$$

Code: `packages/core/src/interior/model.ts`, `gasState` (`heatFlux`, `pr`, `h`).

$$
\mathrm{Re} = \frac{\rho_g\, (v/2)\, d}{\mu_g}, \qquad \rho_g = \frac{m_g}{V_c + A x - (m_c/\rho_s)(1 - z)}, \qquad \lambda_g = \frac{\mu_g\, c_p}{\mathrm{Pr}}, \qquad c_p = \frac{k R}{k - 1}
$$

Code: `packages/core/src/interior/model.ts`, `gasState` (`heatFlux`, `density`, `re`, `conductivity`).

The flux is 0 while the projectile is at rest, for $z \lt 10^{-9}$ and without gas in the barrel. Omitted inputs take the defaults $\mu_g = 6.0\times10^{-5}$ Pa s, $\mathrm{Pr} = 0.69$ and $T_w = 300$ K. The flame temperature has no default.

The cutoff at $z \lt 10^{-9}$ is a choice of the model.

Code: `packages/core/src/interior/model.ts`, `convectiveDefaults`.

## Symbols

| Symbol | Meaning | Stored unit | Unit in `core` |
| --- | --- | --- | --- |
| $m_g$ | Gas mass in the barrel | g | kg |
| $m_\ell$ | Escaped gas mass | g | kg |
| $\dot m_\ell$ | Mass flow through the leak | no kind | kg/s |
| $m_c$ | Charge mass | g | kg |
| $z$ | Burnt fraction | 1 | 1 |
| $V_c$, $V_f$ | Chamber volume, free volume | no kind | m3 |
| $A$ | Bore area | mm2 | m2 |
| $A_\ell(x)$ | Leak area over travel | mm2 | m2 |
| $C_d$ | Discharge coefficient | 1 | 1 |
| $x$ | Travel | mm | m |
| $v$ | Projectile velocity | m/s | m/s |
| $\bar p$, $p_b$ | Mean pressure, base pressure | bar | Pa |
| $p_a$ | Pressure ahead of the projectile | bar | Pa |
| $r$, $r^\ast$ | Pressure ratio $p_a/p_b$, critical ratio | 1 | 1 |
| $\Phi_k$ | Flow factor | 1 | 1 |
| $k$ | Ratio of specific heats | 1 | 1 |
| $\eta$ | Covolume | m3/kg | m3/kg |
| $\rho_s$ | Solid density of the propellant | g/cm3 | kg/m3 |
| $Q$ | Specific energy of the propellant | J/kg | J/kg |
| $R$ | Gas constant of the propellant gas | no kind | J/(kg K) |
| $T$ | Gas temperature | K | K |
| $T_0$ | Flame temperature | K | K |
| $T_w$ | Wall temperature | degC | K |
| $E_\ell$ | Enthalpy carried out by leaking gas | J | J |
| $E_h$, $W_r$ | Heat lost, work against bore resistance | J | J |
| $\dot q$ | Heat flux to the bore | no kind | W |
| $c_h$ | Factor on the heat flux | 1 | 1 |
| $h$ | Heat-transfer coefficient | no kind | W/(m2 K) |
| $d$ | Bore diameter | mm | m |
| $\mathrm{Re}$, $\mathrm{Pr}$ | Reynolds and Prandtl number | 1 | 1 |
| $\rho_g$ | Gas density | g/cm3 | kg/m3 |
| $\mu_g$ | Gas viscosity | no kind | Pa s |
| $\lambda_g$ | Thermal conductivity of the gas | no kind | W/(m K) |
| $c_p$ | Specific heat at constant pressure | no kind | J/(kg K) |

## Assumptions

- The flow through the leak is quasi-steady and adjusts at once to the reservoir state. The leak area is small compared with the bore area. This is not checked.
- The reservoir is the projectile base: the flow uses the base pressure and the mean gas temperature. The enthalpy is evaluated at the mean state, which keeps the adiabat exact.
- The orifice relation is that of a perfect gas. The covolume correction of the choked flow grows with pressure and is absorbed only on average by $C_d$.
- No unburnt propellant leaves with the gas, and no air enters from ahead of the projectile.
- The effective mass keeps the gas kinetic energy share $\delta m_c$ of the whole charge, an error of order $\delta m_\ell v^2/2$.
- The heat loss applies a pipe-flow correlation to the bore. The viscosity, the Prandtl number and the wall temperature are constants over the shot.

## Limits

- No default leak area: no measurement constrains it. A leak area is an input to fit or measure.
- The convective heat loss exists and stays off by default. Turning it on needs a new fit of every powder, and no measured heat loss for a rifle or handgun bore was found (see the gun-bore check below), so the term cannot be checked. It is revisited when such a measurement exists ([#848](https://github.com/OpenReloading/Ballistics/issues/848)).
- Input checks: at least one leak-area point, travels finite, at least 0 and strictly increasing, areas, back pressure and discharge coefficient finite and at least 0. Heat model: flame temperature, viscosity, Prandtl number and wall temperature positive, factor at least 0.
- `closedVessel` with leakage describes a vented vessel with the leak area at travel 0.
- A powder fit to velocities measured from a revolver, without a leak area, puts the gas lost at the cylinder gap into the fitted values, and the simulated pressure can come out too low. The powder fit shows a note when the load's cartridge record is in C.I.P. table IV and the load has no leak area. That table holds the pistol and the revolver cartridges and no firearm field states a revolver, so pistol loads get the note too.
- Research log: [isentropic blowdown closed form](../research/interior-leakage-blowdown-closed-form.md).
- The heat defaults are checked only against figures for gun-size bores (203 mm, four charges: modelled heat 0.82 to 0.93 of uncited, unverified reference figures on a synthetic proxy; a slower synthetic powder puts the two smallest-charge ratios below the 0.8 lower limit). No reference was found for rifle bores. Research log: [heat loss against gun figures](../research/heat-loss-gun-bores.md).
- The loss of muzzle velocity per 0.001 in of annular clearance in an 81 mm mortar proxy is 0.77 to 1.13 times the slope of uncited, unverified reference figures with a discharge coefficient of 0.83 and 0.93 to 1.36 times with 1, depending on the powder. The default of 1 is kept. Research log: [leak against mortar clearance](../research/leak-mortar-clearance.md).
- Not offered: other heat-loss forms (Reynolds analogy), which need neither viscosity nor Prandtl number, and a loss as a fixed fraction of the released energy, which equals a lower $Q$.

## Sources

- [Kneubuehl 2018](../bibliography.md#kneubuehl-2018), pp. 42 to 43 eqs. (2.3:38) to (2.3:43): isentropic orifice flow, the critical pressure ratio eq. (2.3:41).
- [Kneubuehl 2018](../bibliography.md#kneubuehl-2018), p. 100 eq. (3.4:33) and p. 101 eq. (3.4:34): covolume and mass of the gas in the barrel with leakage. p. 102: validity of the quasi-steady relations.
- [Kneubuehl 2018](../bibliography.md#kneubuehl-2018), p. 105 eq. (3.5:2): force constant as gas constant times flame temperature.
- [AMCP 706-150](../bibliography.md#amcp-706-150), p. 2-48 eqs. (2-170) to (2-182): choked flow through a gap. p. 2-51 eq. (2-201): gas mass with leakage. p. 2-52 eq. (2-214): energy balance with escaping gas, without covolume. pp. 2-53 to 2-54: worn rifled guns.
- [AMCP 706-150](../bibliography.md#amcp-706-150), pp. 3-2 to 3-3: heat transfer to the bore by the Reynolds analogy, the bore surface at 300 K.
- [Corner 1950](../bibliography.md#corner-1950), pp. 243 and 254: leakage in worn guns. pp. 246 to 251 eqs. (21) and (23): nozzle energy equation with covolume and the covolume correction of choked flow. p. 258 eq. (42) and pp. 258 to 259: gas mass with leakage and the energy argument with adiabatic expansion. p. 281: base pressure as reservoir pressure in a worn gun.
- [Corner 1950](../bibliography.md#corner-1950), p. 410: chamber replaced by a cylindrical continuation of the bore. p. 411: linear gas velocity from breech to base, gas viscosity of $6\times10^{-4}$ g/(cm s). p. 412 eq. (4): constant Prandtl-number term, from which $\mathrm{Pr} = 0.69$ is inferred. p. 425: reference temperature 300 K.
- [ICAO 1993](../bibliography.md#icao-1993): the sea-level pressure of the back pressure.
- [Hunt 1951](../bibliography.md#hunt-1951), p. 237: leakage in worn guns. p. 242: no unburnt propellant leaves the gun.
- [McAdams 1942](../bibliography.md#mcadams-1942): the Dittus-Boelter form of the pipe-flow correlation (pages unverified).
- [Winterton 1998](../bibliography.md#winterton-1998): origin of that form (unverified).
