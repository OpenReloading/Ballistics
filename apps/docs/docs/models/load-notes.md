---
title: Notes on a saved load
description: The rules that point out, from a load's chronograph sessions, a change of lot, seating, mean velocity or round count worth a second look.
---

# Notes on a saved load

When a saved load is shot again, the workbench compares each session with the one before it and writes a plain note for every difference the rules below find. A note says what differs, with the values and the two sessions they come from. It is no verdict about a load and recommends no charge: the results of this project are simulations, not load data.

## What a session holds

Every session of a load keeps a snapshot of the load as it was when the load was saved with that session: the powder, primer and case lot, the seating length and the firearm's round count (`Load.snapshots`, one per entry of `Load.sessions`). The velocity statistics come from the session's shot strings that are mapped to the load's own charge (within 0.1 mg), without the shots excluded in the session.

Sessions are ordered by date when every session has one, otherwise in the order of `Load.sessions`. Each session is compared with the one before it; the first session has nothing before it.

## Rules

Lot (powder, primer, case):

- A lot that is not recorded in a session gets a note, also in the first session.
- A lot that differs from the earlier session's, both recorded, gets a note. Lots are compared as typed, without leading and trailing spaces.

Seating depth:

$$
\left| L_k - L_{k-1} \right| > 0.01\ \text{mm}
$$

Code: `packages/core/src/load-notes.ts`, `loadNotes` (`seatingTolerance`).

$L$ is the cartridge overall length or the base-to-ogive length, whichever the load is seated by. Two sessions seated by different lengths are not compared. 0.01 mm is the resolution of the length fields.

Mean velocity:

$$
\left| \bar v_k - \bar v_{k-1} \right| > \max\left(s_k,\ s_{k-1}\right)
$$

Code: `packages/core/src/load-notes.ts`, `loadNotes` (`velocity`).

$\bar v$ is the mean and $s$ the sample standard deviation of the counted shots of a session. Both sessions need at least two counted shots, otherwise there is no standard deviation and no note. The threshold is the sessions' own spread: a mean that moved by less than the larger spread of the two sessions is within what each session shows from shot to shot.

Round count:

$$
n_{k-1} < N \le n_k
$$

Code: `packages/core/src/load-notes.ts`, `loadNotes` (`roundCount`).

$n$ is the firearm's round count recorded in a session and $N$ the count the user set on the firearm (`noteAtRoundCount`). A note comes in the session that first reaches $N$, when the session before it recorded a lower count. Without $N$, or without a count in both sessions, there is no note.

## Symbols

| Symbol | Meaning | Stored unit | Unit in `core` |
| --- | --- | --- | --- |
| $L$ | Seating length of the load in a session | mm | mm |
| $\bar v$ | Mean muzzle velocity of the session's strings of the load | m/s | m/s |
| $s$ | Sample standard deviation of those shots | m/s | m/s |
| $n$ | Round count of the firearm at the session | 1 | 1 |
| $N$ | Round count the user set on the firearm | 1 | 1 |

## Dismissing a note

A note can be dismissed for the session it is about. The dismissal is kept with that session's snapshot and stays when the load is saved, copied or exported.

## Limits

- The rules compare recorded values. A lot or a seating length that the user did not enter cannot be told from one that did not change.
- Until the load is saved, a session shows the load as it is now. Saving fixes it: a change of lot made afterwards shows in the next session's snapshot, not in the earlier ones.
- A string that is not mapped to the load's charge is not read for the velocity rule.
- A note is a prompt to check the load again. It does not tell whether the load is acceptable.
