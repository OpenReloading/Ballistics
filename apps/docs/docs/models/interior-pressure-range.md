---
title: Peak-pressure range over input tolerances
description: The spread of the simulated peak pressure when charge, chamber volume, bullet mass, burn coefficient, temperature and start pressure move within their tolerances.
---

# Peak-pressure range over input tolerances

`interiorPressureRange` runs the [M3 model](interior-m3.md) at the ends of the tolerances of six inputs. It reports the lowest and highest peak pressure next to the nominal one. The [sampled band](interior-sampled-band.md) draws the same inputs from distributions instead of moving them to their ends. The limit check of a result reads this range, not the sampled band.

1. Each input moves alone to both ends of its tolerance.
2. All inputs move together, to the ends that raise the pressure and to the ends that lower it.

The range covers input tolerances only and is not a confidence interval.

## Equations

### Moving one input

Charge, chamber volume, bullet mass, burn coefficient and start pressure move by a relative tolerance, the propellant temperature by an absolute one:

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
- Inputs are applied in the order charge, volume, bullet mass, burn coefficient, temperature, start pressure. Once one move leaves the model, the remaining inputs are not applied and are reported with side 0.

### Range

$$
p_\text{low} = \min\bigl(p_\text{nom},\ \min_c p_c\bigr), \qquad
p_\text{high} = \max\bigl(p_\text{nom},\ \max_c p_c\bigr)
$$

Code: `packages/core/src/interior/range.ts`, `toleranceRange` (`lowPressure`, `highPressure`, `complete`).

The minimum and maximum run over the cases $c$ with a valid, finite peak pressure. The range is complete when every case has one. The peak pressure is the peak breech pressure (`peakBreechPressure`) of the model. An invalid run reports its `reason`.

### Placing an entered maximum

A maximum peak pressure $p_\text{max}$ entered with a request is placed against the range, with no further run:

$$
\text{class} =
\begin{cases}
\text{modelDiscrepancy} & p_\text{max} < p_\text{low} \\
\text{aboveRange} & p_\text{max} > p_\text{high} \\
\text{inputPlausible} & \text{otherwise}
\end{cases}
$$

Code: `packages/core/src/interior/range.ts`, `placeMaximum`.

The answer also names the dominant input: the single input whose two ends differ most in peak pressure, an end without a computed value counted as $p_\text{nom}$. It is null when no input moves the pressure.

The class and the message state where the entered number lies against the simulated range, nothing about a load. `inputPlausible` means only that the number is within the spread of the simulation. `modelDiscrepancy` means the simulation and the number do not agree for these inputs, and the model error that the range leaves out can be the cause. The stored limit of a cartridge is not an entered maximum: the limit check is unchanged.

### Default tolerances

| Input | Default tolerance |
| --- | --- |
| Charge | 0.5 % |
| Chamber volume | 1 % |
| Bullet mass | 0 % |
| Burn coefficient | 3 % |
| Propellant temperature | 5 K |
| Start pressure | 20 % |

Code: `packages/core/src/interior/range.ts`, `pressureToleranceDefaults`.

### Powder lot rows

The workbench's Ladder table runs every charge of a charge ladder at the burn coefficient moved to both ends by one stated fraction $t_b$ (3 % unless changed), with every other input at its nominal value:

$$
b^{\pm} = b\,(1 \pm t_b)
$$

Code: `apps/web/src/lib/lot-rows.ts`, `lotLoad` (the burn-coefficient move of `interiorApply` in `packages/core/src/interior/range.ts`).

The rows show the simulated effect of a powder lot that burns faster or slower than the record. They are not a prediction of a lot, and barrel time is a computed value of the model.

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
| $p_\text{max}$ | Maximum peak pressure entered with the request | bar | Pa |
| $s_q$ | Side that raises the pressure | 1 | 1 |
| $b$, $b^{\pm}$ | Burn coefficient (vivacity or geometric coefficient) and its values at the two lots | as the burn law | as the burn law |
| $t_b$ | Burn-rate change of the lot rows | 1 | 1 |

## Assumptions

- The peak pressure is monotone in each input over its tolerance, so the ends of each tolerance give its extreme values.
- The combined cases take every input to the end that moves the pressure the same way. Interactions between inputs are covered only through these two corners.
- The default tolerances are assumptions without a source.

## Limits

- Model error is not part of the range: the range of an input that the model gets wrong is wrong as well.
- The bullet mass tolerance is 0 by default, so the input does not move until a caller sets it. The seating depth changes the chamber volume and the bullet travel and has no tolerance of its own. Inputs without a tolerance (bore area, energy, form function, resistance and others) do not move.
- The range is not a probability statement.
- Research log: [how the range combines input tolerances](../research/interior-pressure-range-method.md).

## Sources

None for the method or the default tolerances. The models it runs cite their sources on their own pages.
