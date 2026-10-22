---
title: Peak-pressure range over input tolerances
description: The spread of the simulated peak pressure when charge, chamber volume, burn coefficient, temperature and start pressure move within their tolerances.
---

# Peak-pressure range over input tolerances

`interiorPressureRange` runs the [M3 model](interior-m3.md) at the ends of the tolerances of five inputs. It reports the lowest and highest peak pressure next to the nominal one.

1. Each input moves alone to both ends of its tolerance.
2. All inputs move together, to the ends that raise the pressure and to the ends that lower it.

The range covers input tolerances only and is not a confidence interval.

## Equations

### Moving one input

Charge, chamber volume, burn coefficient and start pressure move by a relative tolerance, the propellant temperature by an absolute one:

$$
q^{\pm} = q\,(1 \pm t_q), \qquad T^{\pm} = T \pm t_T
$$

Code: `packages/core/src/interior/range.ts`, `relative`, `interiorApply`.

The volume is the chamber volume. The burn coefficient is the vivacity or the coefficient of a geometric law.

### Direction of each input

With $p_q^{+}$ and $p_q^{-}$ the peak pressures at the two ends of input $q$, a missing (invalid) end counted as the nominal pressure:

$$
s_q = \operatorname{sign}\bigl(p_q^{+} - p_q^{-}\bigr)
$$

Code: `packages/core/src/interior/range.ts`, `toleranceRange` (`sides`).

- $s_q = 0$ when both ends are invalid or the tolerance is 0.
- The two combined cases move every input at once: to the side $s_q$ for the pressure-raising case, to $-s_q$ for the pressure-lowering case.
- Inputs are applied in the order charge, volume, burn coefficient, temperature, start pressure. Once one move leaves the model, the remaining inputs are not applied and are reported with side 0.

### Range

$$
p_\text{low} = \min\bigl(p_\text{nom},\ \min_c p_c\bigr), \qquad
p_\text{high} = \max\bigl(p_\text{nom},\ \max_c p_c\bigr)
$$

Code: `packages/core/src/interior/range.ts`, `toleranceRange` (`lowPressure`, `highPressure`, `complete`).

The minimum and maximum run over the cases $c$ with a valid, finite peak pressure. The range is complete when every case has one. The peak pressure is the peak breech pressure (`peakBreechPressure`) of the model. An invalid run reports its `reason`.

### Default tolerances

| Input | Default tolerance |
| --- | --- |
| Charge | 0.5 % |
| Chamber volume | 1 % |
| Burn coefficient | 3 % |
| Propellant temperature | 5 K |
| Start pressure | 20 % |

Code: `packages/core/src/interior/range.ts`, `pressureToleranceDefaults`.

## Symbols

| Symbol | Meaning | Stored unit | Unit in `core` |
| --- | --- | --- | --- |
| $q$, $q^{\pm}$ | Input with a relative tolerance and its moved values | as the input | as the input |
| $t_q$ | Relative tolerance of an input | 1 | 1 |
| $T$, $T^{\pm}$ | Propellant temperature and its moved values | degC | K |
| $t_T$ | Absolute temperature tolerance | no kind | K |
| $p_q^{\pm}$, $p_c$ | Peak pressure at one end of an input, of a case | bar | Pa |
| $p_\text{nom}$ | Nominal peak pressure | bar | Pa |
| $p_\text{low}$, $p_\text{high}$ | Lowest and highest peak pressure of the range | bar | Pa |
| $s_q$ | Side that raises the pressure | 1 | 1 |

## Assumptions

- The peak pressure is monotone in each input over its tolerance, so the ends of each tolerance give its extreme values.
- The combined cases take every input to the end that moves the pressure the same way. Interactions between inputs are covered only through these two corners.
- The default tolerances are assumptions without a source.

## Limits

- Model error is not part of the range: the range of an input that the model gets wrong is wrong as well.
- Inputs without a tolerance (bullet mass, bore area, energy, form function, resistance and others) do not move.
- The range is not a probability statement.

## Sources

None for the method or the default tolerances. The models it runs cite their sources on their own pages.
