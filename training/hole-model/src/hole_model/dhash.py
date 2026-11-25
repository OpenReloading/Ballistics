"""64-bit difference hashes (dHash), and the holdout-side step that stores one per holdout photo in its manifest."""

import json
from collections.abc import Iterable
from pathlib import Path

import numpy as np
from PIL import Image, ImageOps

# a photo within this many bits of a holdout photo counts as a copy of it, as the holdout builds count it
MAX_DISTANCE = 6


def dhash(path: Path) -> int:
    """Bit 8 * row + column is set where a pixel of the 9 x 8 grayscale photo is brighter than its right neighbor."""
    with Image.open(path) as im:
        gray = np.asarray(ImageOps.exif_transpose(im).convert("L").resize((9, 8), Image.Resampling.LANCZOS))
    return sum(1 << i for i, brighter in enumerate((gray[:, :-1] > gray[:, 1:]).ravel()) if brighter)


def distance(a: int, b: int) -> int:
    return (a ^ b).bit_count()


def hash_holdout(folders: Iterable[Path]) -> dict[str, int]:
    """Writes the dHash of each `file` of a holdout `manifest.json` next to its sha256; returns photos per folder."""
    counts = {}
    for folder in folders:
        manifest = folder / "manifest.json"
        rows = json.loads(manifest.read_text())
        for row in rows:
            row["dhash"] = f"{dhash(folder / row['file']):016x}"
        manifest.write_text(json.dumps(rows, ensure_ascii=False, indent=0))
        counts[str(folder)] = len(rows)
    return counts
