"""The input list: label sets per split, checked so that no photo or session sits in two splits."""

import hashlib
import io
import json
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import numpy as np
import numpy.typing as npt
from PIL import Image

SPLITS = ("train", "validation", "test", "holdout")
SHA256 = re.compile(r"^[0-9a-f]{64}$")
SYNTHETIC = "synthetic"
REAL_CONFIRMED = "real confirmed"
REAL_UNCHECKED = "real unchecked"
DATA_CLASSES = (SYNTHETIC, REAL_CONFIRMED, REAL_UNCHECKED)


class SplitError(ValueError):
    """The input list puts a photo or a session in two splits, or a label set is malformed."""


@dataclass(frozen=True)
class Photo:
    """One labeled photo; `scored` when it is usable and its marks complete; `path` is never opened for the holdout.

    `masked` holds x, y, width, height boxes in px whose holes are unknown: the loss and the scores leave them out.
    """

    path: Path
    sha256: str
    session: str
    scored: bool
    diameter: float
    holes: npt.NDArray[np.float32]
    data: str
    masked: npt.NDArray[np.float32]


def _photo(path: Path, raw: Any) -> Photo:
    if not isinstance(raw, dict) or not isinstance(raw.get("sha256"), str) or not SHA256.match(raw["sha256"]):
        raise SplitError(f"{path}: no sha256")
    if not isinstance(raw.get("session"), str) or not raw["session"]:
        raise SplitError(f"{path}: no session")
    diameter = raw.get("visibleDiameterPx")
    if not isinstance(diameter, int | float) or diameter <= 0:
        raise SplitError(f"{path}: no visibleDiameterPx")
    holes = np.array([[h["x"], h["y"]] for h in raw.get("holes", [])], np.float32).reshape(-1, 2)
    scored = raw.get("usable") is True and raw.get("complete") is True
    data = raw.get("data", SYNTHETIC)
    if data not in DATA_CLASSES:
        raise SplitError(f"{path}: data is one of {', '.join(DATA_CLASSES)}")
    masked = np.array(raw.get("masked", []), np.float32).reshape(-1, 4)
    if (masked[:, 2:] <= 0).any():
        raise SplitError(f"{path}: a masked box needs a positive width and height")
    return Photo(path, raw["sha256"], raw["session"], scored, float(diameter), holes, data, masked)


def read_label_set(path: Path, data: bytes | None = None) -> list[Photo]:
    """The photos of a label set file, which sit next to it; `data` is the file's bytes when already read."""
    raw = json.loads(path.read_bytes() if data is None else data)
    if not isinstance(raw, dict) or not isinstance(raw.get("photos"), dict):
        raise SplitError(f"{path}: not a label set")
    return [_photo(path.parent / name, p) for name, p in raw["photos"].items()]


def read_input_list(path: Path) -> tuple[dict[str, list[Photo]], dict[str, list[str]]]:
    """Photos and the sha256 of each label set file as read, per split; refuses a photo or a session in two splits."""
    raw = json.loads(path.read_text())
    if not isinstance(raw, dict) or set(raw) - set(SPLITS) or not raw.get("train"):
        raise SplitError(f"{path}: an input list maps {', '.join(SPLITS)} to label set paths and names a train set")
    files = {s: [(path.parent / f, (path.parent / f).read_bytes()) for f in raw.get(s, [])] for s in SPLITS}
    splits = {s: [p for f, data in fs for p in read_label_set(f, data)] for s, fs in files.items()}
    digests = {s: [hashlib.sha256(data).hexdigest() for _, data in files[s]] for s in SPLITS if s in raw}
    seen: dict[str, str] = {}
    sessions: dict[str, str] = {}
    for split, photos in splits.items():
        for p in photos:
            if seen.setdefault(p.sha256, split) != split:
                raise SplitError(f"photo {p.sha256} is in {seen[p.sha256]} and {split}")
            if sessions.setdefault(p.session, split) != split:
                raise SplitError(f"session {p.session!r} is in {sessions[p.session]} and {split}")
    return splits, digests


def read_photo(p: Photo) -> npt.NDArray[np.uint8]:
    """The photo as H x W x 3 uint8, after checking its bytes against the label set's sha256."""
    data = p.path.read_bytes()
    if hashlib.sha256(data).hexdigest() != p.sha256:
        raise SplitError(f"{p.path}: the bytes do not match the label set's sha256")
    with Image.open(io.BytesIO(data)) as im:
        return np.asarray(im.convert("RGB"))
