"""hole-model convert, train (from scratch, to ONNX and scores.json) and score (a label set)."""

import argparse
import copy
import json
import math
import platform
import subprocess
import sys
from collections.abc import Iterator
from importlib.metadata import version
from pathlib import Path

import numpy as np
import numpy.typing as npt
import torch
from PIL import Image

from hole_model.export import OPSET, export
from hole_model.net import BASE_WIDTHS, HOLE_PX, STRIDE, HoleNet, focal_loss, input_array, loss_mask, target
from hole_model.real_photos import write
from hole_model.scoring import THRESHOLDS, Heat, best, onnx_heat, score, single_thread_session, sweep
from hole_model.splits import (
    DATA_CLASSES,
    SYNTHETIC,
    Photo,
    SplitError,
    read_input_list,
    read_label_set,
    read_photo,
)

WEB_RUNTIME = ("onnxruntime-web", "1.31.1")
PRODUCER = "OpenReloading/Ballistics training/hole-model"
PROJECT = Path(__file__).parents[2]
MAX_PARITY = 1e-5
MAX_ONNX_BYTES = 1 << 20


Sample = tuple[npt.NDArray[np.uint8], npt.NDArray[np.float32], npt.NDArray[np.float32]]


def training_sample(p: Photo, crop: int) -> Sample:
    """Image, target and loss mask; a real photo is scaled so its hole shows at the working size, as the app does."""
    rgb, holes, masked = read_photo(p), p.holes, p.masked
    if p.data != SYNTHETIC:
        f = HOLE_PX / p.diameter
        im = Image.fromarray(rgb)
        rgb = np.asarray(im.resize((round(im.width * f), round(im.height * f)), Image.Resampling.LANCZOS))
        holes, masked = (holes + 0.5) * f - 0.5, masked * f
    h, w = rgb.shape[:2]
    # a photo smaller than the crop is edge-padded, and the padding is masked out of the loss
    rgb = np.pad(rgb, ((0, max(0, crop - h)), (0, max(0, crop - w)), (0, 0)), mode="edge")
    heat = target(holes, HOLE_PX if p.data != SYNTHETIC else p.diameter, *rgb.shape[:2])
    mask = loss_mask(masked, *rgb.shape[:2])
    mask[(h + 1) // STRIDE :] = 0
    mask[:, (w + 1) // STRIDE :] = 0
    return rgb, heat, mask


def torch_heat(net: HoleNet) -> Heat:
    def heat(x: npt.NDArray[np.float32]) -> npt.NDArray[np.float32]:
        with torch.no_grad():
            return np.asarray(net(torch.from_numpy(x))[0, 0].numpy(), np.float32)

    return heat


def f1(r: dict[str, float]) -> float:
    return 2 * r["recall"] * r["precision"] / max(1e-9, r["recall"] + r["precision"])


def real_counts(batch: int, share: float) -> Iterator[int]:
    """Real photos per step; the fraction of `batch * share` carries over, so a small share still draws real ones."""
    carry = 0.0
    while True:
        carry += batch * share
        count = int(carry)
        carry -= count
        yield count


def train_net(photos: list[Photo], validation: list[Photo], args: argparse.Namespace) -> tuple[HoleNet, dict[str, int]]:
    """The net of the best validation F1 score, checked every `eval_every` steps, and the steps it ran and kept."""
    samples = [training_sample(p, args.crop) for p in photos]
    synthetic = [i for i, p in enumerate(photos) if p.data == SYNTHETIC]
    real = [i for i, p in enumerate(photos) if p.data != SYNTHETIC]
    quota = real_counts(args.batch, args.real_share)
    net = HoleNet(args.widths)
    opt = torch.optim.AdamW(net.parameters(), args.lr, weight_decay=1e-4)
    sched = torch.optim.lr_scheduler.OneCycleLR(opt, args.lr, total_steps=args.steps, pct_start=0.1)
    rng = np.random.default_rng(args.seed)
    net.train()
    running = 0.0
    kept = {"steps": args.steps, "bestStep": args.steps}
    best_f1, best_state, waited = -1.0, copy.deepcopy(net.state_dict()), 0
    for step in range(1, args.steps + 1):
        xs, ts, ms = [], [], []
        n_real = args.batch if not synthetic else next(quota) if real else 0
        picks = (
            [synthetic[i] for i in rng.integers(0, len(synthetic), args.batch - n_real)] if n_real < args.batch else []
        )
        if n_real:
            picks += [real[i] for i in rng.integers(0, len(real), n_real)]
        for i in picks:
            image, heat, mask = samples[i]
            h, w = image.shape[:2]
            # even offsets keep the crop on the stride-2 grid of the target
            y, x = (int(rng.integers(0, (n - args.crop) // STRIDE + 1)) * STRIDE for n in (h, w))
            xs.append(image[y : y + args.crop, x : x + args.crop])
            c = args.crop // STRIDE
            ts.append(heat[y // STRIDE : y // STRIDE + c, x // STRIDE : x // STRIDE + c])
            ms.append(mask[y // STRIDE : y // STRIDE + c, x // STRIDE : x // STRIDE + c])
        xb = torch.from_numpy(np.stack(xs)).permute(0, 3, 1, 2).float() / 255
        tb = torch.from_numpy(np.stack(ts))[:, None]
        mb = torch.from_numpy(np.stack(ms))[:, None]
        if rng.random() < 0.5:
            xb, tb, mb = xb.flip(3), tb.flip(3), mb.flip(3)
        if rng.random() < 0.5:
            xb, tb, mb = xb.transpose(2, 3), tb.transpose(2, 3), mb.transpose(2, 3)
        loss = focal_loss(net(xb), tb, mb)
        opt.zero_grad()
        loss.backward()  # type: ignore[no-untyped-call]
        opt.step()
        sched.step()
        running += loss.item()
        if step % 100 == 0:
            print(f"step {step} loss {running / 100:.4f}", flush=True)
            running = 0.0
        if args.eval_every and (step % args.eval_every == 0 or step == args.steps):
            net.eval()
            current = f1(best(score(torch_heat(net), validation, THRESHOLDS)))
            net.train()
            print(f"step {step} validation F1 {current:.4f}", flush=True)
            if current > best_f1:
                best_f1, best_state, waited, kept["bestStep"] = current, copy.deepcopy(net.state_dict()), 0, step
            else:
                waited += 1
            if waited >= args.patience:
                kept["steps"] = step
                break
    if args.eval_every:
        net.load_state_dict(best_state)
    return net, kept


def git_commit(project: Path) -> str:
    """The commit of the project, with "-dirty" when anything in its folder (lockfile and inputs too) is uncommitted."""
    run = subprocess.run(["git", "rev-parse", "HEAD"], cwd=project, capture_output=True, text=True, check=True)
    dirty = subprocess.run(
        ["git", "status", "--porcelain", "--", "."], cwd=project, capture_output=True, text=True, check=True
    )
    return run.stdout.strip() + ("-dirty" if dirty.stdout.strip() else "")


def limit_failures(parity: float, onnx_bytes: int) -> list[str]:
    """The acceptance limits the exported model misses."""
    failures = []
    if not math.isfinite(parity) or parity > MAX_PARITY:
        failures.append(f"ONNX Runtime differs from PyTorch by {parity:.1e}, more than {MAX_PARITY:.0e}")
    if onnx_bytes > MAX_ONNX_BYTES:
        failures.append(f"the ONNX file has {onnx_bytes} bytes, more than {MAX_ONNX_BYTES}")
    return failures


def train(args: argparse.Namespace) -> None:
    torch.set_num_threads(1)
    torch.use_deterministic_algorithms(True)
    torch.manual_seed(args.seed)
    if not 0 <= args.real_share <= 1:
        raise SplitError("--real-share is a fraction from 0 to 1")
    splits, label_sets = read_input_list(args.inputs)
    counts = {
        s: {
            "photos": len(ps),
            "scored": sum(p.scored for p in ps),
            "data": {c: n for c in DATA_CLASSES if (n := sum(p.data == c for p in ps))},
        }
        for s, ps in splits.items()
        if s != "holdout"
    }
    if args.check:
        print(json.dumps(counts))
        return
    del splits["holdout"]
    validation = [p for p in splits["validation"] if p.scored]
    if not validation:
        raise SplitError("the threshold needs a validation split")
    net, kept = train_net([p for p in splits["train"] if p.scored], validation, args)
    args.out.mkdir(parents=True, exist_ok=True)
    onnx_path = args.out / "hole-model.onnx"
    # a run that fails after the export must not leave the scores of an earlier model next to the new one
    (args.out / "scores.json").unlink(missing_ok=True)
    parity = export(net, onnx_path, input_array(read_photo(validation[0])))
    heat = onnx_heat(single_thread_session(str(onnx_path)))
    chosen = best(score(heat, validation, THRESHOLDS))
    test = [p for p in splits["test"] if p.scored]
    scores = {
        "producer": PRODUCER,
        "gitCommit": git_commit(PROJECT),
        "versions": {
            "python": platform.python_version(),
            **{p: version(p) for p in ("torch", "onnx", "onnxruntime", "numpy", "pillow")},
            WEB_RUNTIME[0]: WEB_RUNTIME[1],
        },
        "seeds": {"torch": args.seed, "numpy": args.seed},
        "training": {
            "steps": args.steps,
            "batch": args.batch,
            "crop": args.crop,
            "lr": args.lr,
            "realShare": args.real_share,
            "earlyStopping": {"evalEvery": args.eval_every, "patience": args.patience, **kept},
        },
        "data": counts,
        "labelSets": label_sets,
        "net": {"widths": list(args.widths), "parameters": sum(p.numel() for p in net.parameters())},
        "onnx": {"file": onnx_path.name, "bytes": onnx_path.stat().st_size, "opset": OPSET},
        "parity": {
            "maxAbsDifference": float(f"{parity:.1e}") if math.isfinite(parity) else None,
            "photo": validation[0].sha256,
        },
        "threshold": chosen["threshold"],
        "validation": chosen,
        **({"test": score(heat, test, [chosen["threshold"]])[0]} if test else {}),
        "wrongSize": {
            "split": "test" if test else "validation",
            "rows": sweep(heat, (test or validation)[: args.sweep_photos], chosen["threshold"]),
        },
    }
    (args.out / "scores.json").write_text(json.dumps(scores, indent=2, allow_nan=False) + "\n")
    print(json.dumps(scores, indent=2))
    failures = limit_failures(parity, onnx_path.stat().st_size)
    for f in failures:
        print(f"hole-model: {f}", file=sys.stderr)
    if failures:
        sys.exit(1)


def convert(args: argparse.Namespace) -> None:
    print(json.dumps(write(args.labels, args.posts, args.holdout, args.out, args.validation_share), indent=2))


def score_set(args: argparse.Namespace) -> None:
    heat = onnx_heat(single_thread_session(str(args.model)))
    print(json.dumps(score(heat, read_label_set(args.labels), [args.threshold], args.believed)[0], indent=2))


def main() -> None:
    parser = argparse.ArgumentParser(prog="hole-model")
    sub = parser.add_subparsers(required=True)
    t = sub.add_parser("train", help="train from scratch, export ONNX, write scores.json next to it")
    t.add_argument("--inputs", type=Path, required=True, help="input list: label set paths per split")
    t.add_argument("--out", type=Path, default=Path("runs/base"))
    t.add_argument("--check", action="store_true", help="check the input list and exit")
    t.add_argument("--seed", type=int, default=1)
    t.add_argument("--steps", type=int, default=3000)
    t.add_argument("--batch", type=int, default=32)
    t.add_argument("--crop", type=int, default=128)
    t.add_argument("--lr", type=float, default=3e-3)
    t.add_argument("--widths", type=lambda s: tuple(int(w) for w in s.split(",")), default=BASE_WIDTHS)
    t.add_argument("--sweep-photos", type=int, default=100)
    t.add_argument("--real-share", type=float, default=0.5, help="share of real photos in each batch")
    t.add_argument("--eval-every", type=int, default=500, help="steps between validation checks; 0 keeps the last net")
    t.add_argument("--patience", type=int, default=3, help="validation checks without a better F1 score before a stop")
    t.set_defaults(run=train)
    c = sub.add_parser("convert", help="real photos: train and validation label sets from merged hole marks")
    c.add_argument("--labels", type=Path, required=True, help="merged hole marks, one JSON row per photo")
    c.add_argument("--posts", type=Path, required=True, help="corpus images.jsonl with the source post per photo")
    c.add_argument("--holdout", type=Path, nargs="+", required=True, help="holdout folders: their photos are dropped")
    c.add_argument("--out", type=Path, required=True)
    c.add_argument("--validation-share", type=float, default=0.2, help="share of source posts in the validation split")
    c.set_defaults(run=convert)
    s = sub.add_parser("score", help="score a label set with an exported net")
    s.add_argument("--model", type=Path, required=True)
    s.add_argument("--labels", type=Path, required=True)
    s.add_argument("--threshold", type=float, required=True)
    s.add_argument("--believed", type=float, default=1.0, help="expected over true hole size")
    s.set_defaults(run=score_set)
    args = parser.parse_args()
    try:
        args.run(args)
    except SplitError as e:
        print(f"hole-model: {e}", file=sys.stderr)
        sys.exit(2)
