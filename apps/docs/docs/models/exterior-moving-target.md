---
title: Moving target lead
description: The aim point of a target that moves across the line of sight during the bullet's time of flight, as a distance, an angle and a count of target lengths.
---

# Moving target lead

A target that moves while the bullet is in flight is hit by aiming ahead of it. The [point-mass trajectory](exterior-point-mass.md) gives the time of flight to each range; the lead is the distance the target covers across the line of sight in that time.

## Equations

With target speed $v_t$, heading $\psi$ (0 away from the shooter, $\pi/2$ crossing to the right) and time of flight $t$ to the range $R$, the lateral lead and its angle are:

$$
L = v_t\, t \sin\psi, \qquad \theta = \arctan\frac{L}{R}
$$

Code: `packages/core/src/exterior/moving-target.ts`, `movingTargetLead`.

The lead in target lengths is $L / \ell_t$ for a target of length $\ell_t$ in the direction of its motion. The web app divides by the length typed for the target.

## Symbols

| Symbol | Meaning | Stored unit | Unit in `core` |
| --- | --- | --- | --- |
| $v_t$ | Target speed | m/s | m/s |
| $\psi$ | Target heading, clockwise from the direction away from the shooter | deg | rad |
| $t$ | Time of flight of the bullet to the range | s | s |
| $R$ | Range along the line of sight | m | m |
| $L$ | Lateral lead, positive to the right | m | m |
| $\theta$ | Lead angle | deg | rad |
| $\ell_t$ | Target length | m | m |

## Assumptions

- The target keeps its speed and heading during the flight.
- The time of flight and the range are those of the trajectory to the target's present position.

## Limits

- The part of the motion along the line of sight changes the range at impact and so the time of flight. The model does not iterate for it: a target that crosses at an angle to the line of sight has a lead slightly off in proportion to its approach or retreat during the flight.
- The lead is a geometric aim offset, not a tracking technique. Wind and the bullet's own drift act separately and are in the [trajectory](exterior-point-mass.md) windage.

## Sources

Elementary kinematics of a target at constant velocity. No reference is cited.

- Research log: [lead against the kinematics](../research/exterior-moving-target-kinematics.md).
