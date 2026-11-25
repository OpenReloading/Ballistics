import json
from pathlib import Path
from typing import Any

import numpy as np
import pytest
from PIL import Image

from hole_model.dhash import dhash, hash_holdout
from hole_model.net import loss_mask
from hole_model.real_photos import Holdout, convert, read_holdout, write
from hole_model.splits import SplitError

NO_HOLDOUT = Holdout(frozenset(), frozenset(), frozenset())


def no_dhash(row: dict[str, Any]) -> int:
    """A dHash far from the holdout dHash values of the tests, 0 and the 16 low bits."""
    return 0xFFFF_FFFF_FFFF_0000


def row(name: str, verdict: str = "unchecked", status: str = "partial", **extra: Any) -> dict[str, Any]:
    """A merged row of one photo with one hole and one masked region; the sha256 values derive from `name`."""
    return {
        "image": f"/photos/{name}.jpg",
        "width": 400,
        "height": 300,
        "original_sha256": name[0] * 64,
        "image_sha256": name[-1] * 64,
        "verdict": verdict,
        "positions_status": status,
        "holes": [{"x_px": 100.0, "y_px": 50.0, "diameter_px": 24}, {"x_px": 200.0, "y_px": 80.0, "diameter_px": 20}],
        "masked_regions": [{"box_px": [10.0, 20.0, 30.0, 40.0]}],
        **extra,
    }


def train_set(rows: list[dict[str, Any]], posts: dict[str, str], holdout: Holdout = NO_HOLDOUT) -> dict[str, Any]:
    sets, _ = convert(rows, posts, holdout, 0, no_dhash)
    return sets["train"]


def test_a_partial_photo_trains_with_its_regions_masked_and_its_marks_in_px() -> None:
    assert train_set([row("a1")], {"1" * 64: "post a"}) == {
        "/photos/a1.jpg": {
            "sha256": "1" * 64,
            "session": "post a",
            "usable": True,
            "complete": True,
            "size": [400, 300],
            "visibleDiameterPx": 22,
            "holes": [{"x": 100.0, "y": 50.0, "uncertain": False}, {"x": 200.0, "y": 80.0, "uncertain": False}],
            "masked": [[10.0, 20.0, 30.0, 40.0]],
            "data": "real unchecked",
        }
    }


def test_unusable_photos_and_unchecked_photos_without_complete_or_partial_marks_are_dropped() -> None:
    rows = [row("a1", "unusable"), row("b2", status="unresolved"), row("c3", "fix_later", "complete_visible")]
    sets, dropped = convert(rows, {"1" * 64: "p", "2" * 64: "q", "3" * 64: "r"}, NO_HOLDOUT, 0, no_dhash)
    assert list(sets["train"]) == ["/photos/c3.jpg"]
    assert dropped == {"unusable": 1, "unchecked and neither complete nor partial": 1}


def test_check_answers_make_a_photo_confirmed_and_keep_an_unresolved_one() -> None:
    rows = [row("a1", "correct"), row("b2", "correction", "unresolved"), row("c3", "fix_later")]
    photos = train_set(rows, {"1" * 64: "p", "2" * 64: "q", "3" * 64: "r"})
    assert {name: p["data"] for name, p in photos.items()} == {
        "/photos/a1.jpg": "real confirmed",
        "/photos/b2.jpg": "real confirmed",
        "/photos/c3.jpg": "real unchecked",
    }


def test_photos_matching_a_holdout_photo_by_sha256_or_source_post_are_dropped(tmp_path: Path) -> None:
    images = {"v1": {"sha256": "6" * 64}, "v2": {"original_sha256": "h" * 64}}
    for name, sha, post in (("v1", "a" * 64, "post 1"), ("v2", "f" * 64, "post 2")):
        (tmp_path / name).mkdir()
        manifest = [{"sha256": sha, "source_group": post, "dhash": "0" * 16}]
        (tmp_path / name / "manifest.json").write_text(json.dumps(manifest))
        lines = [{"image": {"source_group": "post 3"}}, {"image": {"source_group": "post 4", **images[name]}}]
        (tmp_path / name / "images.jsonl").write_text("".join(json.dumps(r) + "\n" for r in lines))
    holdout = read_holdout([tmp_path / "v1", tmp_path / "v2"])
    rows = [row("a1"), row("bf"), row("c3"), row("d4"), row("e5"), row("g6"), row("h7")]
    posts = {"1" * 64: "x", "f" * 64: "y", "3" * 64: "post 2", "4" * 64: "post 3", "5" * 64: "z"}
    posts |= {"6" * 64: "u", "7" * 64: "w"}
    sets, dropped = convert(rows, posts, holdout, 0, no_dhash)
    assert list(sets["train"]) == ["/photos/e5.jpg"]
    assert dropped == {"holdout sha256": 4, "holdout post": 2}


def pattern(flip: bool = False) -> Image.Image:
    y, x = np.mgrid[0:150, 0:200]
    gray = (127 + 120 * np.sin(x / 23.0) * np.cos(y / 17.0)).astype(np.uint8)
    return Image.fromarray(gray[:, ::-1] if flip else gray).convert("RGB")


def test_the_dhash_sets_a_bit_where_a_pixel_is_brighter_than_its_right_neighbor(tmp_path: Path) -> None:
    gray = np.tile(np.arange(9, dtype=np.uint8) * 20, (8, 1))
    gray[0] = gray[0][::-1]
    Image.fromarray(gray).save(tmp_path / "g.png")
    assert dhash(tmp_path / "g.png") == 0xFF


def test_a_resized_re_encoded_copy_of_a_holdout_photo_is_dropped_by_its_stored_dhash(tmp_path: Path) -> None:
    holdout = tmp_path / "holdout"
    (holdout / "raw").mkdir(parents=True)
    pattern().save(holdout / "raw" / "h.png")
    rows = [{"sha256": "a" * 64, "source_group": "post h", "file": "raw/h.png"}]
    (holdout / "manifest.json").write_text(json.dumps(rows))
    (holdout / "images.jsonl").write_text("")
    with pytest.raises(SplitError, match="holdout-dhash"):
        read_holdout([holdout])
    assert hash_holdout([holdout]) == {str(holdout): 1}
    assert json.loads((holdout / "manifest.json").read_text())[0]["dhash"] == "f10e0e0ef1f1710e"
    pattern().resize((120, 90)).save(tmp_path / "c3.jpg", quality=60)
    pattern(flip=True).save(tmp_path / "o4.jpg")
    marks = [row("c3", image=str(tmp_path / "c3.jpg")), row("o4", image=str(tmp_path / "o4.jpg"))]
    (tmp_path / "labels.jsonl").write_text("".join(json.dumps(r) + "\n" for r in marks))
    posts = [{"image": {"sha256": c * 64, "original_sha256": o * 64, "source_group": c}} for o, c in ("c3", "o4")]
    (tmp_path / "images.jsonl").write_text("".join(json.dumps(r) + "\n" for r in posts))
    counts = write(tmp_path / "labels.jsonl", tmp_path / "images.jsonl", [holdout], tmp_path / "out", 0.01)
    assert counts["dropped"] == {"holdout dhash": 1}
    assert list(json.loads((tmp_path / "out" / "train.json").read_text())["photos"]) == [str(tmp_path / "o4.jpg")]


@pytest.mark.parametrize("share", [0, 1, 1.5])
def test_a_validation_share_outside_zero_to_one_is_refused(tmp_path: Path, share: float) -> None:
    with pytest.raises(SplitError, match="--validation-share"):
        write(tmp_path / "labels.jsonl", tmp_path / "images.jsonl", [], tmp_path / "out", share)


def test_every_photo_of_a_source_post_sits_in_one_split() -> None:
    rows = [row(f"{c}{c}") for c in "123456789"]
    posts = {c * 64: f"post {int(c) % 3}" for c in "123456789"}
    sets, _ = convert(rows, posts, NO_HOLDOUT, 0.3, no_dhash)
    sessions = {split: {p["session"] for p in photos.values()} for split, photos in sets.items()}
    assert sessions == {"train": {"post 0", "post 1"}, "validation": {"post 2"}}
    assert len(sets["train"]) == 6


def test_the_loss_mask_drops_every_output_cell_a_masked_box_touches() -> None:
    mask = loss_mask(np.array([[3, 2, 4, 3]], np.float32), 8, 10)
    assert mask.tolist() == [
        [1, 1, 1, 1, 1],
        [1, 0, 0, 0, 1],
        [1, 0, 0, 0, 1],
        [1, 1, 1, 1, 1],
    ]


def test_a_masked_box_wholly_outside_the_image_masks_nothing() -> None:
    boxes = np.array([[-6, 2, 2, 2], [4, -8, 4, 4], [30, 2, 4, 4], [2, 30, 4, 4]], np.float32)
    assert loss_mask(boxes, 8, 10).tolist() == [[1.0] * 5] * 4


def test_a_masked_box_partly_outside_the_image_masks_only_its_inside_part() -> None:
    mask = loss_mask(np.array([[-4, 2, 8, 2], [8, 4, 6, 6]], np.float32), 8, 10)
    assert mask.tolist() == [
        [1, 1, 1, 1, 1],
        [0, 0, 1, 1, 1],
        [1, 1, 1, 1, 0],
        [1, 1, 1, 1, 0],
    ]
