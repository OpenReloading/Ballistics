---
title: Charge for a target value
description: The charge at which one M3 interior run reaches a target peak pressure, muzzle velocity, load ratio, barrel time or bullet lead time, found by a log scan and a bracketed root find.
---

# Charge for a target value

`solveCharge` finds the charge at which one [M3](interior-m3.md) run reaches a target value of one quantity: peak breech pressure, muzzle velocity, load ratio, barrel time or bullet lead time.

1. A scan over the charges the case allows brackets the target.
2. A bracketed root find runs `interior` at candidate charges until the run's value lies within a relative tolerance of the target.

The answer is the charge with its run, or a refusal with the reason and the values the scanned charges reach. It is a simulated value, not a charge to load.

## Equations

### Target quantities

Peak pressure, muzzle velocity and barrel time are those of the run. The load ratio needs the bulk density of the propellant. The bullet lead time is the muzzle time less the time of 10 % of the peak breech pressure:

$$
L = \frac{m_c}{\rho_b V_c}, \qquad
t_\text{lead} = t_\text{muzzle} - t_{10}
$$

Code: `packages/core/src/interior/charge-solver.ts`, `chargeTargetValue`.

$t_\text{lead}$ is undefined when $t_{10} = 0$ (the breech pressure of the first curve point, the ignition pressure, is at or above 10 % of the peak), and a scanned charge with an undefined or not finite value counts as not valid.

### Highest charge

The highest charge keeps the solid volume and the covolume of the burnt charge below the chamber volume, the rule under which `interior` accepts a load. It also keeps the solid fill at or below 0.64 ([M3 load file](interior-m3.md#load-file)):

$$
m_\text{max} = \min\left(\frac{0.999\,V_c}{\max(1/\rho_s,\ \eta)},\ 0.64\,\rho_s V_c\right)
$$

Code: `packages/core/src/interior/charge-solver.ts`, `chargeUpperBound` (`solidFillLimit`).

### Scan

The scan runs 32 charges, log-spaced from $10^{-3}\,m_\text{max}$ to $m_\text{max}$:

$$
m_i = m_\text{max}\,\bigl(10^{-3}\bigr)^{1 - i/31}, \qquad i = 0, \dots, 31
$$

Code: `packages/core/src/interior/charge-solver.ts`, `scanCharges` (`scanPoints`, `scanSpan`).

The lowest and highest values over the valid scanned runs, each with its charge, are the reachable range. Neighbouring valid scan points with values on opposite sides of the target form a bracket. A scanned run already within the tolerance is returned when there is at most one bracket.

### Root find

In the bracket $[a, b]$ with $f = y(m) - y^\ast$, the Illinois variant of false position takes

$$
c = \frac{a\,f_b - b\,f_a}{f_b - f_a}
$$

Code: `packages/core/src/interior/charge-solver.ts`, `illinoisRoot`.

and replaces the end whose $f$ has the sign of $f_c$. When the same end is replaced twice in a row, the function value of the other end is halved. A $c$ outside the open bracket is replaced by the midpoint, and so is a $c$ whose run is not valid. The search stops when

$$
\lvert y(c) - y^\ast \rvert \le 10^{-6}\,y^\ast
$$

Code: `packages/core/src/interior/charge-solver.ts`, `within`, `chargeSolverTolerance`.

or after 60 iterations. An iteration runs `interior` twice where the false-position charge gives no valid run, so a call makes at most $32 + 2 \cdot 60$ runs (`chargeSolverMaxRuns`).

### Refusals

- `noValidRun`: no scanned charge gives a valid run with the target defined. The refusal carries the reason and field of the first invalid run.
- `belowRange`, `aboveRange`: the target lies outside the reachable range.
- `notMonotone`: more than one bracket, so the scan crosses the target more than once.
- `bracketFailed`: the target lies in the range but no two neighbouring valid scan points enclose it, or the midpoint run inside the bracket is not valid.
- `toleranceNotReached`: 60 iterations did not reach the tolerance.

The target value must be above 0, and the load ratio target needs a bulk density.

## Symbols

| Symbol | Meaning | Stored unit | Unit in `core` |
| --- | --- | --- | --- |
| $m_c$, $m_i$, $m_\text{max}$ | Charge mass, scanned charge, highest charge | g | kg |
| $a$, $b$, $c$ | Bracket ends and candidate charge | g | kg |
| $V_c$ | Chamber volume behind the seated bullet | no kind | m3 |
| $\rho_s$ | Solid density of the propellant | g/cm3 | kg/m3 |
| $\rho_b$ | Bulk density of the propellant | g/cm3 | kg/m3 |
| $\eta$ | Covolume | m3/kg | m3/kg |
| $L$ | Load ratio | 1 | 1 |
| $t_\text{muzzle}$, $t_{10}$, $t_\text{lead}$ | Muzzle time, time of 10 % peak pressure, bullet lead time | no kind | s |
| $y$, $y^\ast$, $f$ | Target quantity of a run, target value, their difference | as the quantity | Pa, m/s, 1 or s |

## Assumptions

- The target quantity is a continuous function of the charge between neighbouring scan points.
- The load's other inputs (chamber, bullet, propellant, temperature, resistance) stay fixed. `load.charge` is ignored.

## Limits

- A curve that crosses the target twice between two neighbouring scan points is not detected as not monotone.
- The scan covers charges from $10^{-3}\,m_\text{max}$ up, so a target reached only below that is refused.
- The tolerance is on the target value, not on the charge.
- The answer inherits every limit of the [M3 interior model](interior-m3.md).

## Sources

- [Dowell 1971](../bibliography.md#dowell-1971): the modified regula falsi (Illinois) iteration (not read, unverified).
- Research log: [solid fill limit of the interior model](../research/interior-solid-fill-limit.md).
