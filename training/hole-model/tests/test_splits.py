import hashlib
import json
import subprocess
import sys
from pathlib import Path

import numpy as np
from PIL import Image

from hole_model.splits import read_input_list

HOLDOUT_SHA = "c" * 64
MAIN = "from hole_model.cli import main; main()"
FAST = ("--steps", "2", "--batch", "2", "--sweep-photos", "1", "--out", "out")


def photo_set(folder: Path, name: str, session: str, sha: str | None = None) -> str:
    """A label set of one photo; with `sha` the photo file is not written."""
    folder.mkdir(parents=True, exist_ok=True)
    if sha is None:
        noise = np.random.default_rng(sum(name.encode())).integers(0, 255, (128, 128, 3), np.uint8)
        Image.fromarray(noise).save(folder / name)
        sha = hashlib.sha256((folder / name).read_bytes()).hexdigest()
    entry = {
        "sha256": sha,
        "session": session,
        "usable": True,
        "complete": True,
        "visibleDiameterPx": 16,
        "holes": [{"x": 64, "y": 64, "uncertain": False}],
    }
    (folder / "holes.json").write_text(json.dumps({"photos": {name: entry}}))
    return f"{folder.name}/holes.json"


def train(
    tmp_path: Path, holdout_sha: str, holdout_session: str, *extra: str, test: str | None = None, code: str = MAIN
) -> subprocess.CompletedProcess[str]:
    """Runs `hole-model train` through `code`, which may patch the CLI before calling its main."""
    inputs = {
        "train": [photo_set(tmp_path / "train", "a.png", "day 1")],
        "validation": [photo_set(tmp_path / "validation", "b.png", "day 2")],
        "holdout": [photo_set(tmp_path / "holdout", "missing.jpg", holdout_session, holdout_sha)],
    }
    if test:
        inputs["test"] = [test]
    (tmp_path / "inputs.json").write_text(json.dumps(inputs))
    command = [sys.executable, "-c", code, "train", "--inputs", "inputs.json"]
    return subprocess.run([*command, *extra], cwd=tmp_path, capture_output=True, text=True, check=False)


def test_trains_without_opening_the_missing_holdout_photo(tmp_path: Path) -> None:
    run = train(tmp_path, HOLDOUT_SHA, "day 3", "--steps", "2", "--batch", "2", "--sweep-photos", "1", "--out", "out")
    assert run.returncode == 0, run.stderr
    assert (tmp_path / "out" / "scores.json").exists()


def test_refuses_a_training_photo_in_the_holdout(tmp_path: Path) -> None:
    photo_set(tmp_path / "probe", "a.png", "day 1")
    sha = json.loads((tmp_path / "probe" / "holes.json").read_text())["photos"]["a.png"]["sha256"]
    run = train(tmp_path, sha, "day 3", "--check")
    assert run.returncode == 2
    assert run.stderr.endswith(f"hole-model: photo {sha} is in train and holdout\n")


def test_refuses_a_session_in_two_splits(tmp_path: Path) -> None:
    run = train(tmp_path, HOLDOUT_SHA, "day 1", "--check")
    assert run.returncode == 2
    assert run.stderr.endswith("hole-model: session 'day 1' is in train and holdout\n")


def test_a_run_that_fails_after_the_export_leaves_no_scores_of_an_earlier_model(tmp_path: Path) -> None:
    (tmp_path / "out").mkdir()
    (tmp_path / "out" / "scores.json").write_text("{}")
    test = photo_set(tmp_path / "test", "d.png", "day 4", "d" * 64)
    (tmp_path / "test" / "d.png").write_bytes(b"not the labeled photo")
    run = train(tmp_path, HOLDOUT_SHA, "day 3", *FAST, test=test)
    assert run.returncode == 2, run.stderr
    assert run.stderr.endswith("d.png: the bytes do not match the label set's sha256\n")
    assert (tmp_path / "out" / "hole-model.onnx").exists()
    assert not (tmp_path / "out" / "scores.json").exists()


def test_a_non_finite_parity_fails_and_is_written_as_null(tmp_path: Path) -> None:
    nan_parity = "import math, hole_model.cli as c; e = c.export; c.export = lambda *a: [e(*a), math.nan][1]; c.main()"
    run = train(tmp_path, HOLDOUT_SHA, "day 3", *FAST, code=nan_parity)
    assert run.returncode == 1
    assert run.stderr.endswith("hole-model: ONNX Runtime differs from PyTorch by nan, more than 1e-05\n")

    def reject(literal: str) -> None:
        raise ValueError(f"not JSON: {literal}")

    scores = json.loads((tmp_path / "out" / "scores.json").read_text(), parse_constant=reject)
    assert scores["parity"]["maxAbsDifference"] is None


def test_the_label_set_digests_are_of_the_bytes_that_were_parsed(tmp_path: Path) -> None:
    (tmp_path / "holes.json").write_bytes(b'{"photos": {}}')
    (tmp_path / "inputs.json").write_text('{"train": ["holes.json"]}')
    _, digests = read_input_list(tmp_path / "inputs.json")
    (tmp_path / "holes.json").write_bytes(b'{"photos": {"changed.png": {}}}')
    assert digests == {"train": ["a67665246f7fb4e6d78a6a3e8ede9817ee391a59b28fab9c450148728f8c2469"]}
