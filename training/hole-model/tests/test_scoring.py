from pathlib import Path

import numpy as np
import pytest

from hole_model.scoring import score
from hole_model.splits import SYNTHETIC, Photo, SplitError


def test_scoring_without_a_scored_photo_fails(tmp_path: Path) -> None:
    empty = np.zeros((0, 2), np.float32)
    unscored = Photo(tmp_path / "a.png", "a" * 64, "day 1", False, 16.0, empty, SYNTHETIC, np.zeros((0, 4), np.float32))
    for photos in ([], [unscored]):
        with pytest.raises(SplitError, match=r"^no photo to score: scoring needs at least one photo marked usable"):
            score(lambda x: x[0, 0], photos, [0.5])
