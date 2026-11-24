"""Scores an exported net on labeled photos with the label set metric, at the app's working scale."""

from collections.abc import Callable, Sequence

import numpy as np
import numpy.typing as npt
import onnxruntime as ort
from PIL import Image

from hole_model.metric import HoleMatch, correction_stats, corrections, match_holes
from hole_model.net import HOLE_PX, input_array, peaks
from hole_model.splits import Photo, SplitError, read_photo

THRESHOLDS = (0.2, 0.25, 0.3, 0.35, 0.4, 0.45, 0.5, 0.55, 0.6)
BELIEVED = (0.5, 0.6, 0.75, 1.0, 1.3, 1.6, 2.0)

Heat = Callable[[npt.NDArray[np.float32]], npt.NDArray[np.float32]]


def onnx_heat(session: ort.InferenceSession) -> Heat:
    """The heatmap of one 1 x 3 x H x W input through an ONNX Runtime session."""
    return lambda x: np.asarray(session.run(None, {"image": x})[0][0, 0], np.float32)


def single_thread_session(path: str) -> ort.InferenceSession:
    options = ort.SessionOptions()
    options.intra_op_num_threads = 1
    options.inter_op_num_threads = 1
    return ort.InferenceSession(path, options, providers=["CPUExecutionProvider"])


def find(heat: Heat, rgb: npt.NDArray[np.uint8], diameter: float, threshold: float) -> list[tuple[float, float]]:
    """Hole centers in photo px; the photo is scaled so a hole of `diameter` px shows at the working size."""
    f = HOLE_PX / diameter
    im = Image.fromarray(rgb)
    im = im.resize((max(1, round(im.width * f)), max(1, round(im.height * f))), Image.Resampling.LANCZOS)
    out = heat(input_array(np.asarray(im)))[: (im.height + 1) // 2, : (im.width + 1) // 2]
    return [((x + 0.5) / f - 0.5, (y + 0.5) / f - 0.5) for x, y in peaks(out, threshold)]


def score(
    heat: Heat, photos: Sequence[Photo], thresholds: Sequence[float], believed: float = 1.0
) -> list[dict[str, float]]:
    """Recall, precision and corrections of the scored photos per threshold; `believed` is expected over true size."""
    scored = [p for p in photos if p.scored]
    if not scored:
        raise SplitError("no photo to score: scoring needs at least one photo marked usable and complete")
    totals = [np.zeros(3, int) for _ in thresholds]
    per_photo: list[list[int]] = [[] for _ in thresholds]
    for p in scored:
        rgb = read_photo(p)
        truth = [(float(x), float(y)) for x, y in p.holes]
        for k, threshold in enumerate(thresholds):
            m: HoleMatch = match_holes(find(heat, rgb, p.diameter * believed, threshold), truth, p.diameter)
            totals[k] += (m.matched, m.false, m.missed)
            per_photo[k].append(corrections(m))
    return [
        {
            "threshold": threshold,
            "holes": int(t[0] + t[2]),
            "recall": round(float(t[0] / max(1, t[0] + t[2])), 4),
            "precision": round(float(t[0] / max(1, t[0] + t[1])), 4),
            **{f"corrections{k.capitalize()}": v for k, v in correction_stats(c).items()},
        }
        for threshold, t, c in zip(thresholds, totals, per_photo, strict=True)
    ]


def best(results: Sequence[dict[str, float]]) -> dict[str, float]:
    """The threshold with the highest F1 score; the lower threshold on a tie."""

    def f1(r: dict[str, float]) -> float:
        return 2 * r["recall"] * r["precision"] / max(1e-9, r["recall"] + r["precision"])

    return max(results, key=f1)


def sweep(heat: Heat, photos: Sequence[Photo], threshold: float) -> list[dict[str, float]]:
    """Scores at a wrong expected hole size: 0.6 means the app expects 0.6 of the true size."""
    return [{"believed": b, **score(heat, photos, [threshold], b)[0]} for b in BELIEVED]
