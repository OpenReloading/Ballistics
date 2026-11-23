"""hole-model train: trains from scratch, exports ONNX and writes scores.json; hole-model score: scores a label set."""

import argparse
import json
import platform
import subprocess
import sys
from importlib.metadata import version
from pathlib import Path

import numpy as np
import torch

from hole_model.export import OPSET, export
from hole_model.net import BASE_WIDTHS, STRIDE, HoleNet, focal_loss, input_array, target
from hole_model.scoring import THRESHOLDS, best, onnx_heat, score, single_thread_session, sweep
from hole_model.splits import Photo, SplitError, read_input_list, read_label_set, read_photo

WEB_RUNTIME = ("onnxruntime-web", "1.31.1")
PRODUCER = "OpenReloading/Ballistics training/hole-model"


def train_net(photos: list[Photo], args: argparse.Namespace) -> HoleNet:
    images = [read_photo(p) for p in photos]
    heats = [target(p.holes, p.diameter, *im.shape[:2]) for p, im in zip(photos, images, strict=True)]
    if any(min(im.shape[:2]) < args.crop for im in images):
        raise SplitError(f"every training photo needs at least {args.crop} px on each side")
    net = HoleNet(args.widths)
    opt = torch.optim.AdamW(net.parameters(), args.lr, weight_decay=1e-4)
    sched = torch.optim.lr_scheduler.OneCycleLR(opt, args.lr, total_steps=args.steps, pct_start=0.1)
    rng = np.random.default_rng(args.seed)
    net.train()
    running = 0.0
    for step in range(1, args.steps + 1):
        xs, ts = [], []
        for i in rng.integers(0, len(images), args.batch):
            h, w = images[i].shape[:2]
            # even offsets keep the crop on the stride-2 grid of the target
            y, x = (int(rng.integers(0, (n - args.crop) // STRIDE + 1)) * STRIDE for n in (h, w))
            xs.append(images[i][y : y + args.crop, x : x + args.crop])
            c = args.crop // STRIDE
            ts.append(heats[i][y // STRIDE : y // STRIDE + c, x // STRIDE : x // STRIDE + c])
        xb = torch.from_numpy(np.stack(xs)).permute(0, 3, 1, 2).float() / 255
        tb = torch.from_numpy(np.stack(ts))[:, None]
        if rng.random() < 0.5:
            xb, tb = xb.flip(3), tb.flip(3)
        if rng.random() < 0.5:
            xb, tb = xb.transpose(2, 3), tb.transpose(2, 3)
        loss = focal_loss(net(xb), tb)
        opt.zero_grad()
        loss.backward()  # type: ignore[no-untyped-call]
        opt.step()
        sched.step()
        running += loss.item()
        if step % 100 == 0:
            print(f"step {step} loss {running / 100:.4f}", flush=True)
            running = 0.0
    return net


def git_commit() -> str:
    """The commit of this project's code, with "-dirty" when its folder has uncommitted changes."""
    here = Path(__file__).parent
    run = subprocess.run(["git", "rev-parse", "HEAD"], cwd=here, capture_output=True, text=True, check=True)
    dirty = subprocess.run(
        ["git", "status", "--porcelain", "--", ".."], cwd=here, capture_output=True, text=True, check=True
    )
    return run.stdout.strip() + ("-dirty" if dirty.stdout.strip() else "")


def train(args: argparse.Namespace) -> None:
    torch.set_num_threads(1)
    torch.use_deterministic_algorithms(True)
    torch.manual_seed(args.seed)
    splits = read_input_list(args.inputs)
    counts = {s: {"photos": len(ps), "scored": sum(p.scored for p in ps)} for s, ps in splits.items() if s != "holdout"}
    if args.check:
        print(json.dumps(counts))
        return
    del splits["holdout"]
    validation = [p for p in splits["validation"] if p.scored]
    if not validation:
        raise SplitError("the threshold needs a validation split")
    net = train_net([p for p in splits["train"] if p.scored], args)
    args.out.mkdir(parents=True, exist_ok=True)
    torch.save({"producer": PRODUCER, "widths": args.widths, "state": net.state_dict()}, args.out / "hole-model.pt")
    onnx_path = args.out / "hole-model.onnx"
    parity = export(net, onnx_path, input_array(read_photo(validation[0])))
    heat = onnx_heat(single_thread_session(str(onnx_path)))
    chosen = best(score(heat, validation, THRESHOLDS))
    test = [p for p in splits["test"] if p.scored]
    scores = {
        "producer": PRODUCER,
        "gitCommit": git_commit(),
        "versions": {
            "python": platform.python_version(),
            **{p: version(p) for p in ("torch", "onnx", "onnxruntime", "numpy", "pillow")},
            WEB_RUNTIME[0]: WEB_RUNTIME[1],
        },
        "seeds": {"torch": args.seed, "numpy": args.seed},
        "training": {"steps": args.steps, "batch": args.batch, "crop": args.crop, "lr": args.lr},
        "data": counts,
        "net": {"widths": list(args.widths), "parameters": sum(p.numel() for p in net.parameters())},
        "onnx": {"file": onnx_path.name, "bytes": onnx_path.stat().st_size, "opset": OPSET},
        "parity": {"maxAbsDifference": float(f"{parity:.1e}"), "photo": validation[0].sha256},
        "threshold": chosen["threshold"],
        "validation": chosen,
        **({"test": score(heat, test, [chosen["threshold"]])[0]} if test else {}),
        "wrongSize": {
            "split": "test" if test else "validation",
            "rows": sweep(heat, (test or validation)[: args.sweep_photos], chosen["threshold"]),
        },
    }
    (args.out / "scores.json").write_text(json.dumps(scores, indent=2) + "\n")
    print(json.dumps(scores, indent=2))


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
    t.set_defaults(run=train)
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
