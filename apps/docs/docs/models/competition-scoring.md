---
title: Competition scoring
description: How a person's own competition results are scored, ring series and practical stages, with the points and penalties of the event type record.
---

# Competition scoring

A competition event record (user record kind `event`) holds a person's own results: ring series, or practical stages with their hits, penalties and time. The scoring below totals them with the points and penalties of the event's type record ([Event types](../data/event-types.md)), never with values written into the code. A self-recorded score is never an official result.

## Practical stage

The points of a stage are its hits at their zone values, for the power factor the stage was scored with, less its penalties, and never below zero (IPSC Handgun Rules, January 2026 Edition, 9.4 and 9.5.5; USPSA Competition Rules 2026-09, 9.4, 10.1.2 and 9.5.6):

$$
P = \max\left(0,\ \sum_{z \in \{A, C, D, \text{metal}\}} n_z\, p_{z,\phi} - m\, q_{\text{miss}} - s\, q_{\text{no-shoot}} - r\, q_{\text{procedural}}\right)
$$

Code: `packages/core/src/competition/scoring.ts`, `stageRawPoints`.

The hit factor is the points over the stage time (IPSC 9.2.1.1, USPSA 9.2.3.1):

$$
H = \frac{P}{t}
$$

Code: `packages/core/src/competition/scoring.ts`, `hitFactor`.

The stage points of a match give the best hit factor of the stage the stage's maximum points and every other competitor points in proportion. That needs the hit factors of all competitors, which a person's own record does not have. So the stage points are typed from the official result (`stagePoints`), and the event total (IPSC 9.2.3) is their sum, given only when every stage has them:

$$
T = \sum_k S_k
$$

Code: `packages/core/src/competition/scoring.ts`, `practicalEventTotals`.

The no-shoot cap of a rule book (IPSC: two hits per no-shoot, 9.4.2) is applied by the person counting the penalized hits; the record holds that count.

## Ring series

A series totals the ring value of each shot, or, where only the total was written down, that total (DSB Sportordnung, Stand 01.01.2027, 0.11.3). The event total is the sum of the series. Ring values in tenths are summed in tenths, so the total carries no rounding residue:

$$
R = \sum_j \sum_i v_{ij}
$$

Code: `packages/core/src/competition/scoring.ts`, `ringTotal`, `ringEventTotals`.

## Fit to the event type

The scoring trusts that an event fits its type. `eventMismatches` (`packages/core/src/competition/scoring.ts`) names where it does not: a level the type does not list, results of another scoring method, a division the type does not list, or a stage scored major in a division without a major rating. A ring value is a whole ring or tenths, and a series that gives both its shots and its total must agree; the schema refuses anything else.

## Result state

An event ends `completed`, `did-not-finish` or `disqualified`. A disqualified event, or one without series or stages, has no total; the series or stages it holds are still scored one by one.

## Rounds for the firearm count

An event's rounds are its `rounds`, or, for ring series that all list their shots, the number of shots. They are added to the firearm's round count through the same one-confirm flow as a chronograph session's, keyed by the event's reference in `countedSessions`, so an event is counted once (`apps/web/src/lib/firearm.ts`, `eventRounds`, `withEventRounds`).

## Symbols

| Symbol | Meaning | Unit |
| --- | --- | --- |
| $P$ | Points of a stage | 1 |
| $n_z$ | Scoring hits in zone $z$ | 1 |
| $p_{z,\phi}$ | Points of a hit in zone $z$ for power factor $\phi$ (`scoring.points`) | 1 |
| $m$, $s$, $r$ | Misses, penalized no-shoot hits, procedural penalties | 1 |
| $q$ | Points taken off per penalty (`scoring.penalties`) | 1 |
| $t$ | Stage time | s |
| $H$ | Hit factor | 1/s |
| $S_k$ | Typed stage points of stage $k$ | 1 |
| $T$ | Event total of a practical event | 1 |
| $v_{ij}$ | Ring value of shot $i$ of series $j$ | 1 |
| $R$ | Event total of a ring event | 1 |
