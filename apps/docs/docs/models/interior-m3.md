---
title: M3 interior model
description: Interior ballistics with one gas state, a Noble-Abel gas, a pressure gradient, shot start, bore resistance and a pressure-dependent burn law.
---

# M3 interior model

The M3 model computes pressure, travel and velocity of a projectile in the barrel from ignition to muzzle exit.

- One Noble-Abel gas state stands for the whole space behind the projectile.
- The energy of the burning charge goes into gas, projectile motion, rotation, gas motion, bore resistance and heat.
- A two-coefficient gradient gives the base and breech pressures from the mean pressure.
- A pressure-dependent burn law and a form function give the burnt fraction ([burn laws and form functions](interior-burn-forms.md)).
- Gas leakage past the projectile and heat loss to the bore are optional ([leakage and heat loss](interior-leakage-heat.md)).

`interior` runs to the muzzle. `closedVessel` holds the projectile and burns the charge to burnout.

## Equations

### Free volume and pressure

Volume available to the gas, with the unburnt solid and the covolume of the gas taken out:

$$
V_f(z, x) = V_c + A x - \frac{m_c}{\rho_s}(1 - z) - \eta\, m_c z
$$

Code: `packages/core/src/interior/model.ts`, `gasState` (`freeVolume`).

With leakage the covolume term uses the gas still in the barrel ([leakage and heat loss](interior-leakage-heat.md)).

Energy balance (Résal): the energy released by the burnt fraction $z$ of the charge is held as internal energy of the gas, kinetic energy of projectile and gas, work against bore resistance and heat lost to the bore:

$$
m_c Q z = \frac{\bar p\, V_f}{k - 1} + \tfrac{1}{2} m_e v^2 + W_r + E_h
$$

Code: `packages/core/src/interior/model.ts`, `gasState` (`pressure`).

With leakage the enthalpy $E_\ell$ carried out by the leaking gas is a further term next to $W_r$ and $E_h$ ([leakage and heat loss](interior-leakage-heat.md)). Solved for the space-mean pressure, without leakage:

$$
\bar p = \frac{(k - 1)\left(m_c Q z - W_r - E_h - \tfrac{1}{2} m_e v^2\right)}{V_f}
$$

Code: `packages/core/src/interior/model.ts`, `gasState` (`pressure`).

The force constant (impetus) of the propellant is $(k - 1) Q$.

### Effective mass

A rifled bore turns the projectile at $\omega = 2\pi v / L_\text{tw}$. Its rotational energy $\tfrac{1}{2} m_p r_g^2 \omega^2$ is folded into the projectile mass, and the gas kinetic energy $\tfrac{1}{2}\delta m_c v^2$ into the effective mass:

$$
m_p' = m_p \left(1 + \left(\frac{2\pi r_g}{L_\text{tw}}\right)^2\right), \qquad r_g = \frac{d}{2\sqrt{2}} \text{ by default}, \qquad m_e = m_p' + \delta\, m_c
$$

Code: `packages/core/src/interior/model.ts`, `scaleInteriorLoad` (`rg`, `mpr`, `me`).

Without rifling ($L_\text{tw} = 0$), $m_p' = m_p$.

### Motion

$$
m_e \frac{dv}{dt} = A \bar p - F_r(x), \qquad \frac{dx}{dt} = v, \qquad \frac{dW_r}{dt} = F_r(x)\, v, \qquad \frac{dE_h}{dt} = \dot q
$$

Code: `packages/core/src/interior/model.ts`, `interiorRhs`.

$\dot q$ is the heat flux of [leakage and heat loss](interior-leakage-heat.md), 0 by default. While the projectile is held, $dv/dt = dx/dt = 0$ and only the charge burns.

### Pressure gradient

The gas column between breech and base moves with the projectile, its velocity rising from 0 at the breech to $v$ at the base. With the projectile acceleration $a$:

$$
\bar p = p_b + \delta\, \frac{m_c a}{A}, \qquad p_\text{br} = p_b + \varepsilon\, \frac{m_c a}{A}, \qquad m_p' a = A p_b - F_r
$$

Code: `packages/core/src/interior/model.ts`, `gasState` (`basePressure`, `pressures`).

Base and breech pressure from the mean pressure:

$$
p_b = \frac{\bar p + \delta\, m_c F_r / (A\, m_p')}{1 + \delta\, m_c / m_p'}, \qquad p_\text{br} = p_b + \varepsilon\, \frac{m_c}{A} \cdot \frac{A \bar p - F_r}{m_e}
$$

Code: `packages/core/src/interior/model.ts`, `gasState` (`basePressure`, `pressures`).

Default coefficients (Lagrange):

$$
\delta = \tfrac{1}{3}, \qquad \varepsilon = \tfrac{1}{2}
$$

Code: `packages/core/src/interior/model.ts`, `lagrangeGradient`.

A Sébert factor $s$ sets both coefficients to $s$, so the mean pressure equals the breech pressure:

$$
\delta = \varepsilon = s
$$

Code: `packages/core/src/interior/load-file.ts`, `interiorLoad` (`sebert`).

Setting $\varepsilon$ equal to the Sébert factor is a choice of the model, not taken from a source.

While the projectile is at rest, $p_b = p_\text{br} = \bar p$.

### Ignition

With no gas and $v = 0$ the pressure is 0 and the burn rate is 0. The run therefore starts from the burnt fraction $z_0$ that gives the ignition pressure $p_i$ in the closed chamber (the energy balance with $v = 0$, $W_r = E_h = 0$, solved for $z$):

$$
z_0 = \frac{p_i \left(V_c - m_c/\rho_s\right)}{(k - 1)\, m_c Q - p_i\, m_c \left(1/\rho_s - \eta\right)}
$$

Code: `packages/core/src/interior/model.ts`, `runInterior` (`z0`, `bisect`).

For a geometric grain the form variable $f_0$ with $Z(f_0) = z_0$ is found by bisection. A $z_0$ outside $(0, 1)$ makes the run invalid with reason `input` and field `ignitionPressure`.

Starting the run from $z_0$, with the igniter gas taken as propellant gas, is a choice of the model.

### Shot start

The projectile is held at $x = 0$ until the mean pressure reaches the start pressure and the pressure force exceeds the resistance at travel 0:

$$
g_\text{start} = \min\left(\bar p - p_\text{st},\; A \bar p - F_r(0)\right) \ge 0
$$

Code: `packages/core/src/interior/model.ts`, `gasState` (`startG`).

The second term of $g_\text{start}$ is a choice of the model.

Without a start pressure, a caller can take `defaultStartPressure`:

- Barrel of 0.3 m and longer: one value per bullet construction (lead 30.0, jacketed 29.2, monolithic 35.3 MPa), fitted by the load-table powder fit. Plated bullets have no rifle rows and a construction not given takes an assumed 30 MPa.
- Shorter barrel: one value per bullet construction (lead, plated, jacketed, monolithic), fitted by the same fit. A construction not given counts as jacketed, an unknown name is an input error.

These are effective values of the model, not measured shot-start pressures.

The barrel length of 0.3 m that separates the two cases is a choice of the model.

Code: `packages/core/src/interior/start-pressure.ts`, `defaultStartPressure`, `handgunBarrelLengthLimit`.

The workbench takes the construction from the bullet record's `construction.structure` and the barrel length of the seating (else the firearm's, the Settings default or the one assumed for the cartridge class):

| `construction.structure` | Construction |
| --- | --- |
| cast, swaged | lead |
| plated | plated |
| cup-and-core, bonded, partitioned | jacketed |
| monolithic | monolithic |
| frangible, a construction without a structure | jacketed, marked as assumed |

A record without a `construction` gives no construction, and a barrel length that is not known gives no class: the field keeps the value of 30 MPa. A plated bullet in a rifle takes it too. The field follows this default until a value is typed, and the help gives the 95 % interval of the construction. A powder record's own start pressure replaces it, a record without one leaves the field following it. Load files and the API still take the rifle value of 30 MPa for a powder record without a start pressure, so a workbench load is saved with its start pressure as a value.

Code: `packages/core/src/interior/start-pressure.ts`, `constructionOf`, `startPressureOf`.

### Bore resistance

Resistance as a force, a constant friction pressure plus an engraving profile over travel:

$$
F_r(x) = A \left(p_f + p_e(x)\right)
$$

Code: `packages/core/src/interior/model.ts`, `gasState` (`resistance`), `profileAt`.

$p_e(x)$ is interpolated linearly between `{ travel, pressure }` points with increasing travel and is 0 before the first and after the last point. Free travel before the lands is a profile that starts at the jump distance.

The bore-resistance law of the load-table powder fit builds both terms from the cartridge and the bullet: friction stress $\tau_f$ on the bullet side area, raised by the oversize $o$ of the bullet over the groove diameter, and an engraving pressure that falls linearly over the bearing length:

$$
p_f = \tau_f\, \frac{\pi G_1 L}{A} \left(1 + c\, o\right), \qquad o = \max\left(0,\; 100\, \frac{G_1 - Z}{Z}\right), \qquad p_e(x) = \phi_e\, p_\text{st} \left(1 - \frac{x}{L}\right) \text{ for } 0 \le x \le L
$$

Code: `packages/core/src/interior/bore-resistance.ts`, `boreResistance`, `oversizePercent`, `recordResistance`.

- $o$ is taken as 0 without $Z$ and above `maxOversizePercent` (5 %).
- $G_1$ and $Z$ are C.I.P. tolerance limits, not measurements. A run reads $G_1$ from the cartridge record, else the bore diameter.
- The bullet length stands in for the bearing length $L$. The workbench takes the length typed over the bullet record's (`bulletLength`), and `POST /v1/interior/load-file` takes a `bulletLength` override over the record's the same way.
- $\tau_f$, $c$ and $\phi_e$ are stored with the fitted powder parameters.
- A load file can replace the friction pressure (`boreFriction`) and the start and length of the engraving ramp (`engravingPressure`, `engravingLength`).

Code: `packages/core/src/interior/load-file.ts`, `overrideResistance`, `checkResistanceValues`.

The resistance law with $\tau_f$, $c$ and $\phi_e$ and the oversize limit of 5 % are choices of the model, not taken from a source.

A resistance term in proportion to the gas pressure raised the training velocity error at every value tried, and a start pressure in proportion to the bearing length raised the held-out error; neither was adopted ([research entry](../research/interior-bore-resistance-pressure-bearing.md)). Sensitivity to doubled resistance on a synthetic 76 mm proxy (guessed resistance values: start pressure 25 MPa, engraving ramp 40 MPa over 25 mm, friction pressure 8 MPa; "engraving" doubles the ramp), change of peak breech pressure and muzzle velocity:

| Doubled | Full charge (312 MPa, 761 m/s) | 75 % charge (178 MPa, 584 m/s) |
| --- | --- | --- |
| Engraving | +30.5 %, +47 m/s | +39.0 %, +68 m/s |
| Friction | +8.2 %, −4 m/s | +10.1 %, −2 m/s |
| Both | +38.0 %, +36 m/s | +48.2 %, +56 m/s |
| Measured, doubled resistance, term not stated (unverified) | about +10 %, about +6 m/s | about +30 m/s |

Doubled engraving gives the direction of the measured change (more velocity, most at the reduced charge) but several times its size; doubled friction lowers the velocity slightly. The size depends strongly on the guessed proxy.

### Bore area

Where a load gives no bore area, the C.I.P. bore area $Q_\text{CIP}$ of the cartridge applies while the bore diameter is its land diameter $F$ (a typed other bore diameter leaves no record area, as $Q_\text{CIP}$ describes $F$), else the circle of the mean of land diameter $F$ and groove diameter $Z$, else the circle of $F$:

$$
A = Q_\text{CIP} \quad\text{or}\quad A = \frac{\pi}{4}\left(\frac{F + Z}{2}\right)^2 \quad\text{or}\quad A = \frac{\pi}{4} F^2
$$

Code: `packages/core/src/interior/bore-resistance.ts`, `boreArea` and `recordBoreArea`. `packages/core/src/cartridge-specs.ts`, `cartridgeBoreAreaMm2` and `cartridgeLandDiameterMm`.

The circle of the mean of $F$ and $Z$ is a choice of the model, not taken from a source.

The load-table fit, the load file (`interiorLoad`) and the workbench read the same function, so one cartridge has one bore area.

### Throat wear

A worn throat lengthens the space behind the bullet: the bullet still seats in the case, but the bore it meets starts further forward. The optional Throat wear $w$ in the More of the Gun card (the load value `throatWear`, `chamber.throatWear` of the run, m) adds that length times the bore area to the volume behind the bullet the solver starts from; the travel is unchanged, and the case fill and the solid fill keep reading the case volume $V_0$:

$$
V_0' = V_0 + w A
$$

Code: `packages/core/src/interior/throat-wear.ts`, `wornVolume`. `packages/core/src/interior/model.ts`, `scaleInteriorLoad`. `packages/core/src/interior/load-file.ts`, `interiorLoad`.

The default is 0. The wear is a typed value: no rate per round is applied. One barrel measured by [Vuong 2026](../bibliography.md#vuong-2026) (5.56x45 mm, 361 mm, 10-shot means) lost velocity from 840.6 m/s new to 821.3 m/s at 8000 and 785.8 m/s at 16000 rounds, while its chamber grew from 49.20 to 54.62 mm; those values are stored with authors, DOI and licence in `vuong2026` (`packages/core/src/interior/throat-wear-measurement.ts`). Rates do not carry over to another cartridge or firing regime, and an automatic value would need an interval of about 0 to 0.3 to 0.8 mm per 1000 rounds (unverified). When the chosen firearm has a `roundCount` and no throat wear is entered, the result notes say that the velocity may be lower than simulated and give the measured 5.56 rates as an example: 0.29 % per 1000 rounds from 0 to 8000 and 0.54 % per 1000 rounds from 8000 to 16000. The count itself is described in [Firearm round count](../research/firearm-round-count-age.md).

### Temperature of the propellant

The burn rate of the [burn law](interior-burn-forms.md) is multiplied by a factor of the propellant temperature, with separate sensitivities below and above the reference temperature:

$$
\tau_T = \begin{cases} \exp\left(\sigma_h (T_p - T_\text{ref})\right) & T_p \ge T_\text{ref} \\ \exp\left(\sigma_c (T_p - T_\text{ref})\right) & T_p \lt T_\text{ref} \end{cases}
$$

Code: `packages/core/src/interior/model.ts`, `scaleInteriorLoad` (`tauT`, `coef`).

Without temperature sensitivities, $\tau_T = 1$.

A powder record carries them as `temperatureSensitivity`: `reference` in K, `cold` and `hot` in 1/K (`packages/schema/src/powder.ts`). The workbench passes them to the run and offers the temperature ladder for such a powder. A powder record without the field takes the default of its grain form below; one of grain form `other` or without a grain form has none, so $\tau_T = 1$ for it. When such a powder runs at a propellant temperature other than that of its record's fit, the result panel says that the run ignores the temperature for this powder (`apps/web/src/components/workbench-outcome.ts`, `resultNotes`).

#### Default by grain form

The default is approximate: a value of the grain form, not of the powder. Its reference $T_\text{ref}$ is the propellant temperature of the record's fitted model (`interior.propellantTemperature`), else 294.15 K (21 °C).

| Grain form | $\sigma_h$ (1/K) | Interval of $\sigma_h$ | $\sigma_c$ the run takes | Interval of $\sigma_c$ | Source |
|---|---|---|---|---|---|
| ball | 0.0027 | 0.0023 to 0.0031 | 0.0012 | 0 to 0.0030 | [Boulkadid 2016](../bibliography.md#boulkadid-2016): closed-vessel burn-rate sensitivity of deterred ball powders, flattened 0.229 and spherical 0.305 %/K above 21 °C, 0.115 and 0.121 %/K below (as quoted in issue #842; the tables were not re-read for this page, unverified) |
| extruded, flake | 0.0010 | 0.0001 to 0.0029 | 0.0010 | 0 to 0.0030 | [Hodgdon 2012](../bibliography.md#hodgdon-2012): velocities at 70 and 125 °F of 14 extruded powders outside the Extreme line, converted through this model on stand-in loads ([research entry](../research/powder-temperature-default.md)) |
| other | none | | | | |

Code: `packages/core/src/interior/temperature-default.ts`, `defaultSensitivity`, `recordSensitivity`, `coldPeakInterval`. `apps/web/src/lib/interior-request.ts`, `interiorRequest`.

The record's own coefficient always wins. The result notes of a run on the default name it ("Default temperature coefficient of ... powder"). Below the reference the peak pressure is given as an interval, the peaks at $\sigma_c = 0$ and $\sigma_c = 0.0030$, never as a single drop: the measured cold changes of the peak pressure of ball powders (Boulkadid 2016, 0.022 and 0.037 %/K, each within its uncertainty of 0) were not significant, while the model with the measured cold burn-rate sensitivity over-predicts the cold fall of the peak (-13.0 % against about -1.65 % measured at -75 K, issue #842).

Limits: the extruded value rests on maker data whose shots and lots are not stated, and the conversion depends on the stand-in load: the three loads of the entry give 0.0006 to 0.0015 1/K. The ball value is for deterred ball powders with about 10 % nitroglycerin. No value is claimed for the cold side of extruded and flake powders; the run takes the hot value there. The default is applied by the workbench, its powder tuning route and the API's load-file route (`recordSensitivity`, which reads the record's own coefficient first), so a load file runs there as in the workbench; the record runs of the command line (`recordLoad`), which run at the powder's fit temperature unless a row gives another, keep $\tau_T = 1$ for a powder without its own coefficient. Temperature-stabilised lines (such as the Hodgdon Extreme powders, whose velocity moved by about 0.006 %/K in the same table) are not told apart: no record field marks them.

The specific energy can follow the temperature too. The load option `propellant.energyTemperature`, $\beta_Q$ in 1/K, scales it by

$$
Q(T_p) = Q \exp\left(\beta_Q (T_p - T_\text{ref})\right)
$$

Code: `packages/core/src/interior/model.ts`, `energyAtTemperature` (used for the charge energy $m_c Q$ in `scaleInteriorLoad` and for `efficiency`).

The reference $T_\text{ref}$ is that of `temperatureSensitivity`, which a nonzero value needs. The default is 0, which leaves every result unchanged. The convective heat model keeps the unscaled $Q$ in its gas constant $R = (\gamma - 1) Q / T_f$, so a scaled energy there acts as a different gas temperature at a fixed $R$. The option is not a field of the powder record or the load file.

### Scaled state and integration

The state is scaled so that one absolute tolerance fits every component:

$$
Y = \left(f,\; \frac{x}{x_e},\; \frac{v}{v_r},\; \frac{W_r}{m_c Q},\; \frac{E_h}{m_c Q}\right), \qquad v_r = \sqrt{\frac{2 m_c Q}{m_p}}, \qquad \tau = \frac{t\, v_r}{x_e}
$$

Code: `packages/core/src/interior/model.ts`, `scaleInteriorLoad` (`vr`, `ts`), `interiorRhs`.

With leakage the state has two more components ([leakage and heat loss](interior-leakage-heat.md)). The system is integrated in $\tau$ with the Dormand-Prince 5(4) method of the [point-mass page](exterior-point-mass.md), in chunks of `outputStep`. A curve point falls at each chunk end and at each event. Defaults (`interiorDefaults`):

- relative tolerance $10^{-9}$, absolute tolerance $10^{-11}$ on the scaled state
- output step $2\times10^{-6}$ s
- $2\times10^{5}$ steps
- 0.1 s run time

The scaling of the state and the values of `interiorDefaults` are choices of the model. An option that is not a positive finite number makes the run invalid with reason `input` and the option as field.

The right-hand side has kinks at shot start, at form-function breakpoints, at burnout and at profile points. Each is a terminal event, after which the integration restarts, so no step crosses a kink:

| Event | Root function | Direction | Phase |
| --- | --- | --- | --- |
| shot start | $g_\text{start}$ | rising | held, `interior` only |
| form breakpoint $f_k$ | $f - f_k$ | rising | burning |
| burnout | $f - f_\text{end}$ | rising | burning |
| profile point $x_k \lt x_e$ (engraving or leak area) | $x - x_k$ | rising | moving |
| leak onset | $p_b - p_a$ | rising | with leakage |
| muzzle | $x - x_e$ | rising | moving |
| stall | $v$ | falling | moving |
| peak of $\bar p$, $p_b$, $p_\text{br}$ | $dq/d\tau$ | falling | moving, not terminal |

Code: `packages/core/src/interior/model.ts`, `interiorEvents`.

The rate of each pressure $q$ for the peak events is a central difference along the flow of the state:

$$
\frac{dq}{d\tau} \approx \frac{q(Y + \epsilon \dot Y) - q(Y - \epsilon \dot Y)}{2\epsilon}, \qquad \epsilon = 10^{-7}
$$

Code: `packages/core/src/interior/model.ts`, `interiorEvents` (`slopes`).

The step $\epsilon = 10^{-7}$ is a choice of the model.

### Outputs

Muzzle energy and efficiency, with $v_e$ the muzzle velocity:

$$
E_0 = \tfrac{1}{2} m_p v_e^2, \qquad \eta_b = \frac{E_0}{m_c Q}
$$

Code: `packages/core/src/interior/model.ts`, `interior` (`muzzleEnergy`, `efficiency`).

Energy split at the muzzle, the terms adding up to the released energy:

$$
m_c Q z_e = \frac{\bar p V_f}{k - 1} + \tfrac{1}{2} m_p v_e^2 + \tfrac{1}{2}(m_p' - m_p) v_e^2 + \tfrac{1}{2}\delta m_c v_e^2 + W_r + E_h + E_\ell
$$

Code: `packages/core/src/interior/model.ts`, `energyBalance`.

Ten percent pressure time: the last time before the peak at which the breech pressure equals $0.1\, p_\text{br,max}$, interpolated linearly between curve points $j$ and $j+1$, and 0 when the first point is at or above that pressure:

$$
t_{10} = t_j + \left(0.1\, p_\text{br,max} - p_{\text{br},j}\right) \frac{t_{j+1} - t_j}{p_{\text{br},j+1} - p_{\text{br},j}}
$$

Code: `packages/core/src/interior/model.ts`, `interior` (`tenPercentPressureTime`).

The level of 10 % in $t_{10}$ is a choice of the model, not taken from a source.

`peakBreechPressure` is the peak breech pressure, the pressure a chamber transducer measures. The result also carries:

- the peak base and mean pressures, and the three pressures at the muzzle
- shot-start time, barrel time from shot start to muzzle, burnout time and travel
- the burnt fraction at the muzzle

Each curve point has time, travel, velocity, burnt fraction, the three pressures, and the gas temperature where a heat model defines the gas constant.

### Load file

`interiorLoad` maps the values of a workbench load file (SI) onto the model input. The burn law is the vivacity law, with the two-stage form when all four form values are given and the constant form when none is. A leak area is constant over the whole travel. `missingLoadKeys` lists the values it needs that no other source gave (all but the bore area, which falls back to the circle of the bore diameter), so a caller can name every missing value at once instead of the first. The load ratio, charge bulk volume over the volume behind the seated bullet, is:

$$
\Lambda = \frac{m_c}{\rho_\text{bulk} V_c}
$$

Code: `packages/core/src/interior/load-file.ts`, `interiorLoad`, `missingLoadKeys`, `loadRatio`. `packages/core/src/interior/workbench-keys.ts`, `interiorValueKeys`, `burnFormKeys`, `powderModelValues`.

The solid fill, the solid volume of the charge over the same volume, is the packing fraction of the grains in the chamber:

$$
\varphi = \frac{m_c}{\rho_s V_c} = \Lambda\,\frac{\rho_\text{bulk}}{\rho_s}
$$

Code: `packages/core/src/interior/load-file.ts`, `solidFill`.

A charge at its bulk density fills the chamber to $\varphi = \rho_\text{bulk}/\rho_s$, at $\rho_s$ = 1.6 g/cm3 for example 0.61 for a bulk density of 0.98 g/cm3 and 0.55 for 0.88 g/cm3. A random packing of equal spheres reaches at most $\varphi = 0.6366$. A denser fill needs grains that deform or break, which changes their burning surface, and the model takes free grains with a fixed form function. A load is outside the model above:

$$
\varphi_\text{max} = 0.64, \qquad \Lambda_\text{max} = \varphi_\text{max}\,\frac{\rho_s}{\rho_\text{bulk}}
$$

Code: `packages/core/src/interior/load-file.ts`, `solidFillLimit`, `fillLoadRatioLimit`.

- The limit needs no bulk density, so it applies to every run. With a bulk density the API and the workbench state it as the load ratio $\Lambda_\text{max}$ of the powder.
- The [charge solver](interior-charge-solver.md) stops at $\varphi_\text{max}$.
- The `chamberVolume` rule of `interior` stops where the solid volume or the covolume of the charge fills $V_c$, at $\varphi = \min\left(1,\ 1/(\eta \rho_s)\right)$. With $\eta$ = 1 cm3/g and $\rho_s$ = 1.6 g/cm3 that is 0.625, below $\varphi_\text{max}$.

Taking the random close packing of equal spheres as the limit for grains of every shape is a choice of the model.

### Load from records

`recordLoad` builds the run of a load that names a cartridge, a powder and a bullet, for callers that have no form state: the powder record's model parameters (`powderModelValues`), the cartridge's chamber land diameter $F$ as the bore diameter, its twist $u$ and its bore area $Q$ (without $Q$, the circle of the mean of $F$ and the groove diameter $Z$, `boreArea`), the bore resistance of the powder's fit (`recordResistance`) and the powder's temperature sensitivity. The charge, the chamber volume behind the seated bullet, the bullet travel and the bullet mass are the caller's, and so is the propellant temperature (K), which defaults to the temperature of the powder's fit. A powder without an interior model, a missing value or a bore-resistance law without the bullet length is an error, never a run without that term.

Code: `packages/core/src/interior/record-load.ts`, `recordLoad`.

## Symbols

| Symbol | Meaning | Stored unit | Unit in `core` |
| --- | --- | --- | --- |
| $V_c$ | Chamber volume behind the seated projectile base | no kind | m3 |
| $V_f$ | Free volume of the gas | no kind | m3 |
| $A$ | Bore area | mm2 | m2 |
| $Q_\text{CIP}$ | C.I.P. bore area Q of the cartridge | mm2 | mm2 |
| $F$, $Z$ | C.I.P. land and groove diameter | mm | mm |
| $G_1$ | C.I.P. bullet diameter | mm | mm |
| $d$ | Bore diameter | mm | m |
| $x$, $x_e$ | Travel, travel from the seated position to the muzzle | mm | m |
| $L_\text{tw}$ | Twist length, 0 without rifling | mm | m |
| $L$ | Bearing length, the bullet length in a run | mm | mm |
| $m_p$ | Projectile mass | g | kg |
| $m_p'$, $m_e$ | Projectile mass with rotation, effective mass | g | kg |
| $r_g$ | Axial radius of gyration of the projectile | mm | m |
| $m_c$ | Charge mass | g | kg |
| $Q$ | Specific energy of the propellant at constant volume | J/kg | J/kg |
| $k$ | Ratio of specific heats of the gas | 1 | 1 |
| $\rho_s$ | Solid density of the propellant | g/cm3 | kg/m3 |
| $\rho_\text{bulk}$ | Bulk density of the propellant | g/cm3 | kg/m3 |
| $\eta$ | Covolume | m3/kg | m3/kg |
| $z$, $z_0$, $z_e$ | Burnt fraction, at ignition, at the muzzle | 1 | 1 |
| $f$ | Form variable of the burn law | 1 | 1 |
| $v$, $v_e$ | Projectile velocity, at the muzzle | m/s | m/s |
| $t$ | Time from ignition | no kind | s |
| $\bar p$, $p_b$, $p_\text{br}$ | Mean, base and breech pressure | bar | Pa |
| $p_i$ | Ignition pressure | bar | Pa |
| $p_\text{st}$ | Shot-start pressure | bar | Pa |
| $p_f$, $p_e$ | Friction pressure, engraving pressure | bar | Pa |
| $F_r$ | Resistance force | no kind | N |
| $\tau_f$ | Friction stress of the resistance law | bar | Pa |
| $c$ | Oversize coefficient | no kind | 1/% |
| $o$ | Oversize of the bullet over the groove diameter | no kind | % |
| $\phi_e$ | Engraving fraction of the start pressure | 1 | 1 |
| $\delta$, $\varepsilon$, $s$ | Gradient coefficients, Sébert factor | 1 | 1 |
| $W_r$ | Work against bore resistance | J | J |
| $E_h$, $E_\ell$ | Heat lost to the bore, enthalpy carried out by leaking gas | J | J |
| $\dot q$ | Heat flux to the bore | no kind | W |
| $T_p$, $T_\text{ref}$ | Propellant temperature, reference temperature | degC | K |
| $\sigma_c$, $\sigma_h$ | Burn-rate temperature sensitivity below and above $T_\text{ref}$ | no kind | 1/K |
| $\tau_T$ | Temperature factor on the burn rate | 1 | 1 |
| $v_r$ | Reference velocity of the scaled state | m/s | m/s |
| $E_0$ | Muzzle energy | J | J |
| $\eta_b$ | Ballistic efficiency | 1 | 1 |
| $\Lambda$, $\Lambda_\text{max}$ | Load ratio, at the solid fill limit | 1 | 1 |
| $\varphi$, $\varphi_\text{max}$ | Solid fill, its limit | 1 | 1 |
| $p_h$ | Hold pressure | bar | Pa |
| $E_p$, $E_v$ | Elasticity of the peak mean pressure and the muzzle velocity to $p_h$ | 1 | 1 |

## Assumptions

- One gas state for the whole space behind the projectile. The gradient coefficients describe a gas column of uniform density whose velocity rises linearly from breech to base.
- The igniter gas is propellant gas of the same specific energy. Results depend on $p_i$, and the barrel time grows without bound as $p_i$ and $p_\text{st}$ both approach 0.
- The mean pressure drives the burn rate.
- The projectile moves only after the start condition holds, and it does not move backwards. A projectile whose velocity falls to 0 ends the run.
- The rotational energy follows the twist without slip. The default radius of gyration is that of a solid cylinder of the bore diameter.
- Without a heat model the losses to the bore are absorbed in $k$.
- The exponential form of $\tau_T$ is a choice of the model, not taken from a source.

## Limits

- Not modelled: air ahead of the projectile, recoil and a moving breech, primer energy beyond the ignition pressure, pressure waves, erosion, a spread of grain sizes, the effect of the initial temperature on the gas energy unless `propellant.energyTemperature` is set (default 0, not stored on powder records), ageing and moisture of the powder.
- The temperature term of the gas energy is not adopted: on synthetic loads it carries about a fifth of the muzzle-velocity change for a temperature step, and the fitted temperature factor absorbs it inside the calibrated temperature range (simulations, [research log](../research/propellant-temperature-energy.md)). The check on measured temperature ladders is pending.
- Temperature of ball powder: 75 K below the reference, the model gives a peak pressure 13.0 % lower where a measurement gives 1.65 % lower (both unverified, the measurement without a named source). The temperature sensitivity of single-base powders spreads from 0.013 to 0.074 %/K (unverified), as wide as the spread between bases, and the fitted temperature factor already holds the share of the gas energy ([research log](../research/propellant-temperature-energy.md)).
- The Lagrange coefficients assume a gas column of uniform density. Against the self-similar column of an isentropic gas with linear velocity (all of the charge burnt, ratio of specific heats 1.24 to 1.26, [Corner 1950](../bibliography.md#corner-1950), pages unverified) they put the breech and mean pressures over the base pressure high by 0.2 % at $m_c/m_p' = 0.28$, 0.6 to 0.7 % at 0.51 and 1.8 to 2.1 % at 1.03 (breech over base 1.515 against 1.489, mean over base 1.343 against 1.315). The error grows with a heavy charge behind a light projectile ([research log](../research/interior-lagrange-gradient-size.md)).
- The primer enters only through the ignition pressure $p_i$. On the load-file example of the API ($p_\text{st}$ = 100 bar), $p_i$ from 5 to 100 bar leaves the muzzle velocity at 824.774 m/s, because the projectile is held until $p_\text{st}$. Above $p_\text{st}$, $p_i$ becomes the hold pressure: 200 bar gives 836.635 m/s, 1.44 % more ([charge too small](#charge-too-small), [research log](../research/interior-primer-ignition-pressure.md)).
  - Primer output: in open air, [Courtney 2014](../bibliography.md#courtney-2014) measured blast pressures of 2908 kPa (Fed 210M), 3811 kPa (Fed 215M), 2561 kPa (CCI 200) and 3587 kPa (CCI 250); an ignition pressure anywhere from 3 to 20 MPa (unverified) changes nothing while it stays below the start pressure. The lead-free KVB-7E gave 1186 kPa, 59 % below the Fed 210M, and 19 of 20 small DDNP primers misfired after hot and humid storage (same source); neither is a quantity of the interior model.
  - Primer energy has no source. In the model, 10 J more (unverified) raises the muzzle velocity by 0.05 % on a rifle load and 0.38 % on a handgun load; the one correlation found (R = 0.92, unverified) relates the total primer mass to the mass of priming compound, not to an energy.
- Ageing and moisture: the burn law and the thermochemistry assume fresh powder of the record's composition. Residual water (about 1 % by mass in rolled powder, unverified), solvent residue and stabilizer consumed in storage (typically 1.5 to 2 % at manufacture, unverified) are not inputs, so a fitted burn coefficient does not hold for old or damp powder ([research log](../research/interior-powder-ageing-moisture.md)).
  - Moisture: powder dried by about 0.5 % of its weight raised the peak pressure from 320 to 355 MPa (+10.9 %) and the muzzle velocity from 770 to 790 m/s (+2.6 %) in a single loading ([Vihtavuori 2018](../bibliography.md#vihtavuori-2018-moisture)), while the same maker calls its N568 powder, like all its reloading powders, insensitive to humidity changes ([Vihtavuori 2021](../bibliography.md#vihtavuori-2021-n568)).
  - Ageing: a 5.56×45 mm ball powder stored at 71 °C for 10, 20 and 30 days gave a peak pressure 13.7, 20.4 and 30.8 % higher and a muzzle velocity 1.8, 3.1 and 4.3 % higher, fired at 21 °C, with no significant change of the burn rate at 21 °C ([Boulkadid 2016](../bibliography.md#boulkadid-2016)).
- The bullet material is not an input of the resistance law. Effects on the bore resistance that were looked at and are left out:
  - Barrel friction: [Courtney 2014](../bibliography.md#courtney-2014) take the energy lost to friction in 5.56×45 mm NATO (62 gr flat base bullet, Blue Dot, 25 rounds per primer and charge, $R^2$ above 0.995) as the intercept of muzzle energy against charge: 330 ± 2 ft·lbf with a Fed 205M primer, 376 ± 35 and 322 ± 40 ft·lbf with two DDNP primers. The method is in [Boyle 2012a](../bibliography.md#boyle-2012-friction) (only the abstract was read). The intercept may also hold offsets other than friction, so it does not set a default friction pressure: over a 0.508 m barrel (unverified) 330 ft·lbf is about 880 N, about 35 MPa on 25 mm² of bore or about 9 % of an assumed 380 MPa peak.
  - Bullet coatings changed the friction by −15 % to +19 %, the sign varying ([Boyle 2012b](../bibliography.md#boyle-2012-coatings), abstract only), so the friction is not changed for a coating.
  - Steel against copper jackets: two sets of four .30-06 rounds gave 33 against 36 kpsi and 2270 against 2300 ft/s, 8.3 % less pressure and 1.3 % less velocity with steel, in an informal test ([Faber](../bibliography.md#faber-steel-jackets)); no change of the friction pressure alone reproduces both.
  - Bullet hardness: no usable coefficient from hardness to start pressure, nor for a gas check, was found. The core hardness shows no effect in the fitted resistance: the median effective density is the same at Brinell hardness 12 and 18 (unverified).
  - Polygonal rifling: three pistols with polygonal and three with grooved barrels gave mean muzzle velocities of 324.7 and 321.3 m/s (means of the published values), inside standard deviations of 6 to 10 m/s and with a different pistol for each barrel; the authors find no significant difference ([Silva-Rivera 2021](../bibliography.md#silva-rivera-2021)).
  - Suppressor: a 190 gr ABLR load in .300 Win Mag lost about 30 ft/s (about 1 %) with a K-baffle suppressor ([Courtney 2017](../bibliography.md#courtney-2017)); no pressure was measured. Not from that paper: the peak pressure occurs early in the bore (at 6 to 8 % of the barrel length, unverified), long before the bullet reaches the suppressor.
  - Bore wall temperature: no effect while the heat-loss term is off, the default ([leakage and heat loss](./interior-leakage-heat.md#limits)).
- Neck pull and crimp are not inputs: the start pressure is fitted. The minimum bullet pull of 35 lbf (156 N) for 5.56 mm M193 ([MIL-C-9963F](../bibliography.md#mil-c-9963f)) is about 6.1 MPa on the base of a 5.56 mm bullet; other military rounds are given up to 267 N and 5.6 to 7.9 MPa (unverified). All lie inside the fitted start pressure. In the model, one MPa more start pressure moves a .308 load by +0.53 % peak pressure and +0.11 % velocity (unverified); no force by crimp class was found.
- The heat model is the only term that depends on the size of the gun. Without it, peak pressure and velocity against travel in calibres are unchanged when every length is multiplied by $s$, volumes, masses and the charge by $s^3$, areas by $s^2$ and grain dimensions by $s$, and times scale with $s$ ([research log](../research/interior-exact-scaling-sensitivity.md)). With the convective heat loss (flame temperature 2800 K, factor 1) on the seven-perforation rifle load of the research entry, $s$ from 0.5 to 5 moved peak pressure by -0.35 to +0.66 % and muzzle velocity by -0.64 to +1.2 %.
- Validity reasons of an invalid result: `input` with the first invalid field, `chamberVolume` (solid volume or covolume of the charge not below $V_c$), `noShotStart` (burnout before the projectile moves), `stuck` (velocity back to 0), `integration` (step size or step count), `maxTime` (run time reached before the muzzle).
- Input checks: all values finite, volumes, areas, lengths, masses, energies, densities, temperatures and $p_i$ positive, $k \gt 1$, $\eta \ge 0$, $L_\text{tw} \ge 0$, $p_\text{st} \ge 0$, profile travels strictly increasing.
- `tenPercentPressureTime` is linear between curve points and depends on the output step.
- A projectile that slows before the muzzle without stopping is a valid run with no note: when the gas force falls below the bore friction late in the bore, the slowdown shows only in the curve. The interior test load with a charge of 0.6 g, a 1.5 m barrel and a friction pressure of 5 MPa leaves the muzzle at 189.4 m/s after 195.6 m/s in the bore. On printed load rows it occurs in 0.19 % of runs (muzzle velocity below 0.99 of the highest), all slow loads with high friction, so no note flags it ([research log](../research/interior-plausibility-notes.md)).
- Reference values, not limits: on 52,391 runs of printed load rows, the ratio of the equivalent constant pressure $(m_p + m_c/2) v_e^2 / (2 A L)$ to the peak breech pressure lies between 0.12 and 0.67 and the efficiency $\eta_b$ between 0.076 and 0.49 for 99 % of runs, the expansion ratio $(V_c + A L)/V_c$ between 5.5 and 15.7 for 90 %. The bands are too wide to catch a doubled chamber volume or a halved bullet mass, so no note uses them ([research log](../research/interior-plausibility-notes.md)).
- `barrelTime` runs from shot start.
- Charge too small (`chargeTooSmall`): the API warns when the peak mean pressure is below 2.2 times the hold pressure ([charge too small](#charge-too-small)).
- Solid fill above 0.64 (`solidFillLimit`): the API (`loadRatioHigh`) and the workbench warn ([load file](#load-file)).
- Inputs the run ignores or holds once: the API and the workbench say so ([advisories](#advisories)).
- How close a result is to measured loads, with the held-out error by rifle and handgun: [How close a result is](../how-close.md).
- Research log: [constant-surface closed form](../research/interior-constant-surface-closed-form.md), [closed vessel](../research/interior-closed-vessel-closed-forms.md), [published worked example](../research/interior-published-worked-example.md), [internal consistency checks](../research/interior-internal-consistency-checks.md), [Sébert factor](../research/interior-sebert-factor-choice.md), [charge too small](../research/interior-charge-too-small-bound.md), [solid fill limit](../research/interior-solid-fill-limit.md), [Lagrange gradient size](../research/interior-lagrange-gradient-size.md), [primer and ignition pressure](../research/interior-primer-ignition-pressure.md), [powder ageing and moisture](../research/interior-powder-ageing-moisture.md), [plausibility notes](../research/interior-plausibility-notes.md).
- Research log, choices fitted to load tables: [engraving ramp](../research/interior-engraving-ramp.md), [start pressure by construction and class](../research/interior-start-pressure-rules.md), [bullet material](../research/interior-bore-resistance-material.md), [magnum primer factor](../research/interior-magnum-primer-term.md).

### Charge too small

The projectile stays at rest until the mean pressure reaches the start pressure, and the run starts at the ignition pressure. The larger of the two is the hold pressure, an effective value of the model ([shot start](#shot-start)). The elasticities give the share of a relative change of the hold pressure that reaches the result:

$$
p_h = \max(p_\text{st},\ p_i), \qquad E_p = \frac{\partial \ln \bar p_\text{max}}{\partial \ln p_h}, \qquad E_v = \frac{\partial \ln v_e}{\partial \ln p_h}
$$

Code: `packages/core/src/interior/model.ts`, `chargeTooSmall`.

Central differences at 5 % of $p_h$ over a charge ladder of five made-up loads (rifle, rifle with bore resistance, magnum with the two-stage form, pistol, lead-bullet pistol) give:

- Without bore resistance, $E_p$ is close to one function of $r = \bar p_\text{max} / p_h$ for every load: 0.68 to 0.70 at $r = 1.5$, 0.5 at $r$ = 2.18 to 2.39, 1/3 at $r$ = 3.7 to 4.3.
- With $p_\text{st} = 0$, where $p_i$ is the hold pressure, $E_p$ is 0.5 at $r$ = 2.1 to 2.3.
- $E_v$ is below $E_p$ except near a projectile that stops.
- With bore resistance, $E_p$ stays below 0.45 above $r = 1.1$: the resistance, not $p_h$, holds the projectile.
- At $E_p = 0.5$ the peak mean pressure lies between 0.17 and 0.33 of the cartridge maximum pressure, so the rule does not compare with a cartridge pressure.

The bound is $E_p = 0.5$: half of a relative error of the hold pressure reaches the peak pressure. With the start-pressure tolerance of 20 % of the pressure range (`pressureToleranceDefaults`), the start pressure alone then moves the peak by about 10 %. A load is too small for the model below:

$$
\bar p_\text{max} \lt 2.2\, p_h
$$

Code: `packages/core/src/interior/model.ts`, `chargeTooSmallRatio`. `packages/api/src/compute/limits.ts`, `chargeWarning`.

The ratio 2.2 is the rounded low end of $r$ at the bound over the loads. With bore resistance it flags more loads than the bound needs. The bound of 0.5 is a choice of the model, not taken from a source.

### Advisories

One registry in core lists every rule that tells a user something about a run: the seven warning codes of the API and the three input rules below. Each rule has a code, a severity, the input keys it reads, a short name, a message and a fix. An `error` blocks a run, a `warn` or `info` never changes a result: the rules read the load and the run, and the run is the same with or without them. A message states facts about the inputs and the model, never a statement about the load. The API warning enum, the `severity`, `inputs` and `fix` of each warning and the names in the workbench's warnings line all come from the registry.

The input rules use the bore resistance at travel 0, the friction pressure plus the engraving pressure at travel 0 (the profile is 0 before its first point):

$$
p_0 = p_f + p_e(0)
$$

Code: `packages/core/src/advisories.ts`, `advisoryRules`, `interiorAdvisories`. `packages/api/src/compute/limits.ts`, `warning`, `limitCheck`.

- `startPressureBelowResistance`: $0 \lt p_\text{st} \le p_0$. The start condition of [shot start](#shot-start) is then decided by the second term, so the start pressure has no effect. A start pressure of 0 counts as not given.
- `gyrationRadiusWithoutTwist`: a radius of gyration is given and $L_\text{tw} = 0$. The [effective mass](#effective-mass) then has no rotational term, so the radius is ignored.
- `startPressureHeldOnce`: $p_\text{st} \gt p_0$, $p_\text{st} \gt p_\text{i}$ (the ignition pressure) and $p_e(0) \gt 0$. The projectile is held until the pressure reaches $p_\text{st}$ and then starts against $p_0$, which is lower. $p_0$ is the resistance at shot start only: the engraving profile can rise with travel, so the resistance later in the motion can exceed $p_0$ and $p_\text{st}$. With $p_\text{i} \ge p_\text{st}$ the [shot start](#shot-start) condition holds at ignition and there is no hold.

### Cartridges listed by the manufacturer

A powder record may carry `listedCartridges`: the ids of the cartridge records the manufacturer lists the powder for on its product page or data sheet, with a source whose `fields` names the list (`packages/schema/src/powder.ts`). It says what the manufacturer lists, not a recommendation, and it is no input of the model. Absent means not recorded, never none. Load data of the manufacturer, such as charges per cartridge, is not stored with it.

When the powder record has a list and the chosen cartridge record is not in it, the workbench's result notes carry one warning: "<cartridge> is not among the cartridges the manufacturer lists this powder for." A listed cartridge, a powder without a list or a run without a cartridge record give none. The powder record page shows the list as "Listed by the manufacturer for", its source with the record's other sources.

Code: `apps/web/src/components/workbench-outcome.ts`, `unlistedCartridge`. `packages/data/src/references.ts`, `checkCartridgeReferences` (each id names a current cartridge record).

### Cast bullet hardness

A plain-base cast bullet that is harder than the pressure behind it can upset does not swell to fill the bore, and gas can leak past it. The rule of thumb for the pressure that upsets a cast bullet is 1422 psi per Brinell hardness number, about 9.80 MPa per BHN, for plain-base cast bullets only (Fryxell, "Cast Bullet Alloys and Obturation", quoted by [Wikipedia, Obturation](https://en.wikipedia.org/wiki/Obturation); the essay itself was not retrieved, unverified):

$$
p_\text{ob} = 9.80\ \text{MPa} \cdot \text{BHN}
$$

Code: `packages/core/src/interior/obturation.ts`, `obturationPressurePerBrinell`, `plainBaseCastHardness`, `castHarderThanPeak`. `apps/web/src/components/workbench-outcome.ts`, `derived`.

The workbench's result notes carry the warning "possible gas leakage" when the bullet record has `construction.structure` `cast`, no gas check (`gasCheck` absent or `false`), a `construction.core.hardness`, and $p_\text{ob}$ is above the simulated peak breech pressure. Any of the three missing gives none. The warning states no number, and the run is not changed: the model has no leak past the bullet, no default leak area and no coefficient for a gas check, since no source gives one. The research entry [cast bullet hardness against peak pressure](../research/cast-bullet-hardness-peak-pressure.md) has the solver's response to a leak area.

## Sources

- [Kneubuehl 2018](../bibliography.md#kneubuehl-2018), p. 76 eq. (3.3:27): energy balance with the free volume and covolume.
- [Kneubuehl 2018](../bibliography.md#kneubuehl-2018), p. 77 eq. (3.3:28): one effective mass with the Sébert factor.
- [Kneubuehl 2018](../bibliography.md#kneubuehl-2018), p. 77 eq. (3.3:30): start pressure and bore resistance in the equation of motion.
- [Kneubuehl 2018](../bibliography.md#kneubuehl-2018), pp. 85 to 87 eqs. (3.4:5) to (3.4:7): angular velocity from the twist and the torque on the projectile.
- [AMCP 706-150](../bibliography.md#amcp-706-150), pp. 1-4 and 2-4, eqs. (2-6) to (2-8) and (2-11): rotational energy folded into an effective mass, the radius of gyration of a solid cylinder.
- [Baer 1962](../bibliography.md#baer-1962), pp. 15 to 16: rotational energy among the secondary energy terms.
- [Corner 1950](../bibliography.md#corner-1950): free volume with covolume, the Lagrange gradient (pages unverified).
- [Hunt 1951](../bibliography.md#hunt-1951): the Lagrange gradient (pages unverified).
- [AMCP 706-150](../bibliography.md#amcp-706-150), p. 2-4 and p. 2-6 eq. (2-20): the Lagrange gradient.
- [AMCP 706-150](../bibliography.md#amcp-706-150), p. 2-5 eq. (2-16): free volume with covolume.
- [AMCP 706-150](../bibliography.md#amcp-706-150), p. 2-5 eqs. (2-13) and (2-14): heat loss taken into an adjusted ratio of specific heats.
- [Kneubuehl 2018](../bibliography.md#kneubuehl-2018), p. 82 eqs. (3.3:31) and (3.3:32): efficiency, kinetic energy of the gas.
- [Kneubuehl 2018](../bibliography.md#kneubuehl-2018), p. 83 eqs. (3.4:1a) to (3.4:2): the equation system of motion and pressure.
- [Baer 1962](../bibliography.md#baer-1962), p. 17 eq. (18), pp. 21 to 22 eqs. (34) and (34a): work against bore resistance, resistance pressure over travel.
- [Baer 1962](../bibliography.md#baer-1962), p. 26 eq. (42) and p. 27: igniter pressure at time 0, shot-start pressure.
- [Scott 1969](../bibliography.md#scott-1969): density of the random close packing of equal spheres, 0.6366.
