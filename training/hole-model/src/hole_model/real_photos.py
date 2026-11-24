"""Converts the merged hole marks of real photos into train and validation label sets, without holdout matches."""

import hashlib
import json
import re
import statistics
from collections import Counter
from collections.abc import Callable, Iterable, Sequence
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from hole_model.dhash import MAX_DISTANCE, dhash, distance
from hole_model.splits import REAL_CONFIRMED, REAL_UNCHECKED, SplitError

CONFIRMED = ("correct", "correction")
UNCHECKED = ("unchecked", "fix_later")
UNUSABLE = "unusable"
# model marks that are complete outside their masked regions; the other statuses train only when confirmed
TRAINABLE_STATUS = ("complete_visible", "partial")
DHASH = re.compile(r"^[0-9a-f]{16}$")


@dataclass(frozen=True)
class Holdout:
    """The sha256 values, source posts and dHash values of the holdout photos; nothing else of them is read."""

    hashes: frozenset[str]
    posts: frozenset[str]
    dhashes: frozenset[int]

    def near(self, photo_dhash: int) -> bool:
        """Whether a photo of this dHash is within `MAX_DISTANCE` bits of a holdout photo."""
        return any(distance(photo_dhash, d) <= MAX_DISTANCE for d in self.dhashes)


def _rows(path: Path) -> list[dict[str, Any]]:
    return [json.loads(line) for line in path.read_text().splitlines() if line.strip()]


def read_holdout(folders: Iterable[Path]) -> Holdout:
    """`sha256`, `source_group` and `dhash` of manifest.json rows; `sha256`, `original_sha256`, `source_group` of
    images.jsonl rows."""
    hashes: set[str] = set()
    posts: set[str] = set()
    dhashes: set[int] = set()
    for folder in folders:
        for row in json.loads((folder / "manifest.json").read_text()):
            if not DHASH.match(row.get("dhash", "")):
                raise SplitError(
                    f"{folder}: a manifest row without a dhash; run hole-model holdout-dhash on the folder"
                )
            hashes.add(row["sha256"])
            posts.add(row["source_group"])
            dhashes.add(int(row["dhash"], 16))
        for row in _rows(folder / "images.jsonl"):
            image = row["image"]
            hashes.update(image[k] for k in ("sha256", "original_sha256") if k in image)
            posts.add(image["source_group"])
    return Holdout(frozenset(hashes), frozenset(posts), frozenset(dhashes))


def read_posts(path: Path) -> dict[str, str]:
    """The source post of each photo of a corpus `images.jsonl`, by its image sha256 and its original sha256."""
    posts: dict[str, str] = {}
    for row in _rows(path):
        image = row["image"]
        posts[image["sha256"]] = posts[image["original_sha256"]] = image["source_group"]
    return posts


def in_validation(post: str, share: float) -> bool:
    """A fixed share of the source posts, chosen by the hash of the post so a rerun splits the same way."""
    return int(hashlib.sha256(post.encode()).hexdigest()[:8], 16) < share * 2**32


def entry(row: dict[str, Any], post: str, data: str) -> dict[str, Any]:
    """The label set entry of a merged row: holes in px, its masked regions as px boxes, the median hole diameter."""
    return {
        "sha256": row["image_sha256"],
        "session": post,
        "usable": True,
        # every hole outside the masked boxes is marked
        "complete": True,
        "size": [row["width"], row["height"]],
        "visibleDiameterPx": statistics.median(h["diameter_px"] for h in row["holes"] if h.get("diameter_px")),
        "holes": [{"x": h["x_px"], "y": h["y_px"], "uncertain": False} for h in row["holes"]],
        "masked": [r["box_px"] for r in row["masked_regions"]],
        "data": data,
    }


def convert(
    rows: Iterable[dict[str, Any]],
    posts: dict[str, str],
    holdout: Holdout,
    validation_share: float,
    photo_dhash: Callable[[dict[str, Any]], int],
) -> tuple[dict[str, dict[str, Any]], Counter[str]]:
    """The train and validation label sets, keyed by image path, and the dropped photos per reason; `photo_dhash`
    gives the dHash of a row's photo."""
    sets: dict[str, dict[str, Any]] = {"train": {}, "validation": {}}
    dropped: Counter[str] = Counter()
    for row in rows:
        verdict = row["verdict"]
        if verdict not in (*CONFIRMED, *UNCHECKED, UNUSABLE):
            raise SplitError(f"{row['image']}: unknown verdict {verdict!r}")
        post = posts.get(row["image_sha256"]) or posts.get(row["original_sha256"])
        if post is None:
            raise SplitError(f"{row['image']}: no source post")
        if row["image_sha256"] in holdout.hashes or row["original_sha256"] in holdout.hashes:
            dropped["holdout sha256"] += 1
        elif post in holdout.posts:
            dropped["holdout post"] += 1
        elif holdout.near(photo_dhash(row)):
            dropped["holdout dhash"] += 1
        elif verdict == UNUSABLE:
            dropped["unusable"] += 1
        elif verdict in UNCHECKED and row["positions_status"] not in TRAINABLE_STATUS:
            dropped["unchecked and neither complete nor partial"] += 1
        elif not any(h.get("diameter_px") for h in row["holes"]):
            dropped["no hole size"] += 1
        else:
            data = REAL_CONFIRMED if verdict in CONFIRMED else REAL_UNCHECKED
            split = "validation" if in_validation(post, validation_share) else "train"
            sets[split][row["image"]] = entry(row, post, data)
    return sets, dropped


def write(
    labels: Path, posts: Path, holdout: Sequence[Path], out: Path, validation_share: float
) -> dict[str, dict[str, int]]:
    """Writes train.json and validation.json into `out`; returns the photos per split and data class and the drops."""
    if not 0 < validation_share < 1:
        raise SplitError("--validation-share is a fraction between 0 and 1, both excluded")
    sets, dropped = convert(
        _rows(labels), read_posts(posts), read_holdout(holdout), validation_share, lambda row: dhash(Path(row["image"]))
    )
    out.mkdir(parents=True, exist_ok=True)
    counts: dict[str, dict[str, int]] = {"dropped": dict(sorted(dropped.items()))}
    for split, photos in sets.items():
        (out / f"{split}.json").write_text(json.dumps({"photos": photos}, indent=1) + "\n")
        counts[split] = dict(sorted(Counter(p["data"] for p in photos.values()).items()))
    return counts
