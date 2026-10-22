---
title: Atmosphere
description: ICAO standard troposphere, station air, humid-air density and speed of sound, and the air along the trajectory.
---

# Atmosphere

The exterior model reads air density and the speed of sound at every point of the trajectory. The air is given as station air at the firing point: altitude, absolute station pressure, temperature and relative humidity.

## Equations

### ICAO standard troposphere

In the troposphere the temperature falls linearly with the geopotential altitude. Hydrostatic balance with the ideal-gas law gives the pressure as a power of the temperature ratio:

$$
T(H) = T_0 - L H, \qquad p(H) = p_0 \left(\frac{T(H)}{T_0}\right)^{g_0/(R_d L)}
$$

Code: `packages/core/src/exterior/atmosphere.ts`, `standardAtmosphere` (`pressureExponent`), constants in `icao`.

A sea-level pressure (QNH) converts to a station pressure through the same profile, $p_s = p_{\mathrm{QNH}}\,p(H)/p_0$. The model takes station pressure only. The caller does this conversion.

### Air along the trajectory

At height $y$ above the firing point the temperature falls at the ICAO lapse rate from the station value, and the pressure follows hydrostatically from the station pressure, not from the sea-level profile. The relative humidity is held:

$$
T(y) = T_s - L y, \qquad p(y) = p_s \left(\frac{T(y)}{T_s}\right)^{g_0/(R_d L)}, \qquad \phi(y) = \phi
$$

Code: `packages/core/src/exterior/atmosphere.ts`, `airAt`.

### Saturation vapour pressure

Magnus form over water, with $t = T - 273.15$ in degC:

$$
e_s(T) = 611.2\ \mathrm{Pa}\cdot\exp\!\left(\frac{17.62\,t}{243.12 + t}\right), \qquad e = \phi\,e_s(T)
$$

Code: `packages/core/src/exterior/atmosphere.ts`, `saturationVapourPressure`.

### Density of moist air

Partial pressure of dry air over its gas constant plus partial pressure of the vapour over its gas constant:

$$
\rho = \frac{p - e}{R_d T} + \frac{e}{R_v T}, \qquad R_v = \frac{R^*}{M_v}
$$

Code: `packages/core/src/exterior/atmosphere.ts`, `airDensity` (`vapourGas`).

### Speed of sound in moist air

With the vapour mole fraction $x_v = e/p$, the mixture gas constant follows from the mean molar mass, and the molar heat capacity at constant pressure is the mole-weighted mean of rigid diatomic dry air ($3.5\,R^*$) and rigid triatomic vapour ($4\,R^*$):

$$
R_m = \frac{R_d}{1 - x_v + x_v M_v/M_d}, \qquad \frac{c_p}{R^*} = 3.5 + 0.5\,x_v, \qquad a = \sqrt{\frac{c_p}{c_p - R^*}\,R_m T}
$$

Code: `packages/core/src/exterior/atmosphere.ts`, `speedOfSound` (`vapourRatio`).

With $\phi = 0$ both reduce to the dry-air ICAO formulas.

## Symbols

| Symbol | Meaning | Stored unit | Unit in `core` |
| --- | --- | --- | --- |
| $H$ | Geopotential altitude above mean sea level | mm | m |
| $y$ | Height above the firing point | mm | m |
| $T$, $T_s$ | Air temperature, at the station | degC | K |
| $T_0$ | ICAO sea-level temperature, 288.15 K | degC | K |
| $p$, $p_s$ | Absolute air pressure, at the station | bar | Pa |
| $p_0$ | ICAO sea-level pressure, 101325 Pa | bar | Pa |
| $L$ | Temperature lapse rate, 0.0065 K/m | no kind | K/m |
| $g_0$ | Standard gravity, 9.80665 m/s² | no kind | m/s² |
| $R_d$ | Specific gas constant of dry air, 287.05287 J/(kg K) | no kind | J/(kg K) |
| $R^*$ | Universal gas constant of the ICAO atmosphere, 8.31432 J/(mol K) | no kind | J/(mol K) |
| $M_v$ | Molar mass of water vapour, 0.01801528 kg/mol | kg/kmol | kg/mol |
| $M_d$ | Molar mass of dry air, $R^*/R_d$ | kg/kmol | kg/mol |
| $R_v$, $R_m$ | Gas constant of water vapour, of the mixture | no kind | J/(kg K) |
| $\phi$ | Relative humidity | % | fraction 0 to 1 |
| $e_s$, $e$ | Saturation vapour pressure, vapour pressure | bar | Pa |
| $x_v$ | Mole fraction of water vapour | 1 | 1 |
| $c_p$ | Molar heat capacity of the mixture at constant pressure | no kind | J/(mol K) |
| $\rho$ | Air density | g/cm3 | kg/m³ |
| $a$ | Speed of sound | m/s | m/s |

## Assumptions

- Only the tropospheric layer of the ICAO atmosphere, with a constant lapse rate. Altitudes are geopotential.
- Moist air is an ideal mixture of ideal gases. The compressibility factor of the CIPM-2007 density formula (close to 1 at ambient conditions) is left out.
- Water vapour and dry air have the heat capacities of rigid molecules, independent of temperature.
- The enhancement factor of water vapour in air is left out of the saturation vapour pressure.
- Along the path the relative humidity is held, not the mixing ratio. The hydrostatic pressure uses the dry-air gas constant (no virtual-temperature correction).

## Limits

- Altitudes from -5000 m (`minAltitude`) to 11000 m (the tropopause). A trajectory that leaves this band stops with the reason `atmosphere`.
- `checkAir` rejects a temperature at or below 0 K, a relative humidity outside 0 to 1, a pressure at or below the vapour pressure, and non-finite values.
- The Magnus constants are those for water. Below 0 degC the formula still gives the pressure over water, not over ice.

## Sources

- [ICAO 1993](../bibliography.md#icao-1993): defining constants of the standard atmosphere and the tropospheric temperature and pressure laws.
- [Kneubuehl 2018](../bibliography.md#kneubuehl-2018), section 5.2.2.2 (ICAO atmosphere) and section 5.2.3 (real conditions, the air along the path in 5.2.3.1).
- [WMO-No. 8](../bibliography.md#wmo-no-8), Annex 4.B: Magnus formula for the saturation vapour pressure over water (edition and constants unverified against the current edition).
- [Picard 2008](../bibliography.md#picard-2008): CIPM-2007 density of moist air, the real-gas form the model simplifies.
- [Cramer 1993](../bibliography.md#cramer-1993): speed of sound and ratio of specific heats in humid air, the real-gas form the model simplifies.
