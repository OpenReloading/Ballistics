import math
import subprocess
from itertools import islice
from pathlib import Path

import numpy as np

from hole_model.cli import git_commit, limit_failures, real_counts, training_sample
from hole_model.splits import REAL_UNCHECKED, Photo

GIT = ["git", "-c", "user.name=test", "-c", "user.email=test@example.org", "-c", "commit.gpgsign=false"]


def test_an_uncommitted_change_anywhere_in_the_project_marks_the_commit_dirty(tmp_path: Path) -> None:
    project = tmp_path / "training" / "hole-model"
    (project / "src" / "hole_model").mkdir(parents=True)
    (project / "src" / "hole_model" / "cli.py").write_text("")
    (project / "pyproject.toml").write_text("")
    subprocess.run([*GIT, "init", "-q"], cwd=tmp_path, check=True)
    subprocess.run([*GIT, "add", "."], cwd=tmp_path, check=True)
    subprocess.run([*GIT, "commit", "-q", "-m", "init"], cwd=tmp_path, check=True)
    (tmp_path / "elsewhere.txt").write_text("outside the project")
    assert not git_commit(project).endswith("-dirty")
    (project / "pyproject.toml").write_text("[project]\n")
    assert git_commit(project).endswith("-dirty")


def test_a_model_over_the_limits_fails() -> None:
    assert limit_failures(1e-5, 1_048_576) == []
    assert limit_failures(1.2e-5, 1_048_577) == [
        "ONNX Runtime differs from PyTorch by 1.2e-05, more than 1e-05",
        "the ONNX file has 1048577 bytes, more than 1048576",
    ]


def test_a_non_finite_parity_fails() -> None:
    assert limit_failures(math.nan, 0) == ["ONNX Runtime differs from PyTorch by nan, more than 1e-05"]
    assert limit_failures(math.inf, 0) == ["ONNX Runtime differs from PyTorch by inf, more than 1e-05"]


def test_a_small_real_share_still_draws_real_photos_over_several_steps() -> None:
    assert list(islice(real_counts(1, 0.5), 6)) == [0, 1, 0, 1, 0, 1]
    assert list(islice(real_counts(2, 0.25), 8)) == [0, 1, 0, 1, 0, 1, 0, 1]
    assert sum(islice(real_counts(4, 0.1), 10)) == 4


def test_a_share_that_gives_a_whole_count_keeps_it_every_step() -> None:
    assert list(islice(real_counts(32, 0.25), 3)) == [8, 8, 8]
    assert list(islice(real_counts(32, 0.5), 3)) == [16, 16, 16]
    assert list(islice(real_counts(32, 0.75), 3)) == [24, 24, 24]
    assert list(islice(real_counts(32, 0.0), 3)) == [0, 0, 0]
    assert list(islice(real_counts(32, 1.0), 3)) == [32, 32, 32]


def test_a_product_that_is_whole_on_paper_is_exact_in_floating_point() -> None:
    assert list(islice(real_counts(100, 0.29), 6)) == [29] * 6
    assert list(islice(real_counts(90, 0.7), 6)) == [63] * 6


def test_every_whole_product_of_a_batch_and_a_percent_share_is_kept_every_step() -> None:
    for batch in range(1, 257):
        for percent in range(101):
            if batch * percent % 100 == 0:
                assert list(islice(real_counts(batch, percent / 100), 4)) == [batch * percent // 100] * 4, (
                    batch,
                    percent,
                )


def test_a_real_photo_scaled_to_a_jittered_hole_size_moves_its_hole_and_widens_its_target() -> None:
    holes = np.array([[10.5, 6.5]], np.float32)
    photo = Photo(Path("p.png"), "0" * 64, "post", True, 16.0, holes, REAL_UNCHECKED, np.zeros((0, 4), np.float32))
    image, heat, mask = training_sample(photo, np.zeros((24, 40, 3), np.uint8), 32, 32.0)
    assert image.shape == (48, 80, 3)
    assert heat.shape == (24, 40)
    assert np.argwhere(heat == 1.0).tolist() == [[7, 11]]
    # the center sits at cell 10.75, 6.75 and sigma is 0.09 * 32 px: exp(-(1.25**2 + 0.25**2) / (2 * 2.88**2))
    assert round(float(heat[7, 12]), 4) == 0.9067
    assert mask.min() == 1.0
