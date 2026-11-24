"""The label set metric of packages/target-recognition/src/hole-matching.ts, ported one to one."""

import math
from collections.abc import Sequence
from dataclasses import dataclass

Point = tuple[float, float]


@dataclass(frozen=True)
class HoleMatch:
    matched: int
    false: int
    missed: int


def match_holes(marks: Sequence[Point], holes: Sequence[Point], diameter: float) -> HoleMatch:
    """Pairs marks with holes one to one, nearest pairs first, when they lie within half of `diameter`."""
    pairs = sorted(
        (d, i, j)
        for i, h in enumerate(holes)
        for j, m in enumerate(marks)
        if (d := math.hypot(m[0] - h[0], m[1] - h[1])) <= diameter / 2
    )
    paired: set[int] = set()
    used: set[int] = set()
    for _, i, j in pairs:
        if i in paired or j in used:
            continue
        paired.add(i)
        used.add(j)
    return HoleMatch(len(paired), len(marks) - len(paired), len(holes) - len(paired))


def corrections(m: HoleMatch) -> int:
    """Adds, moves and deletes; a false mark paired with a missed hole is one move."""
    return max(m.false, m.missed)


def percentile(ordered: Sequence[float], q: float) -> float:
    """Linear interpolation between the closest ranks, as packages/statistics/src/percentile.ts."""
    rank = q * (len(ordered) - 1)
    i = math.floor(rank)
    low = ordered[i]
    high = ordered[i + 1] if i + 1 < len(ordered) else low
    return low + (rank - i) * (high - low)


def correction_stats(per_photo: Sequence[int]) -> dict[str, float]:
    """Median, 90th percentile (only from 20 photos on) and maximum of the corrections per photo."""
    ordered = sorted(per_photo)
    stats = {"photos": len(ordered), "median": percentile(ordered, 0.5), "max": percentile(ordered, 1)}
    if len(ordered) >= 20:
        stats["p90"] = percentile(ordered, 0.9)
    return stats
