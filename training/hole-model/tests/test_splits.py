import hashlib
import json
import subprocess
import sys
from pathlib import Path

import numpy as np
from PIL import Image

HOLDOUT_SHA = "c" * 64


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


def train(tmp_path: Path, holdout_sha: str, holdout_session: str, *extra: str) -> subprocess.CompletedProcess[str]:
    inputs = {
        "train": [photo_set(tmp_path / "train", "a.png", "day 1")],
        "validation": [photo_set(tmp_path / "validation", "b.png", "day 2")],
        "holdout": [photo_set(tmp_path / "holdout", "missing.jpg", holdout_session, holdout_sha)],
    }
    (tmp_path / "inputs.json").write_text(json.dumps(inputs))
    command = [sys.executable, "-c", "from hole_model.cli import main; main()", "train", "--inputs", "inputs.json"]
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
