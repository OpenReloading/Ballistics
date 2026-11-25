# Hole model training

Trains the hole center heatmap net of the target photo editor from random weights, exports it to ONNX and writes every score to `scores.json` next to the model. It is a Python project with its own lockfile, outside the pnpm workspace, the app bundle and `pnpm test`.

## License rule

The trained weights are to be published as CC0, so nothing in this project may carry third-party terms into them:

- No `ultralytics` package: its AGPL-3.0 also covers models trained from scratch with its code (https://www.ultralytics.com/license).
- No pretrained weights: no `torchvision`, `timm`, `huggingface-hub` or `safetensors` package, no use of `torch.hub` or `torchvision.models` (aliases included), no `torch.load`, `from_pretrained` or URL downloads of weights, and no checkpoint files in the project. Training always starts from random weights and never loads a checkpoint.
- Training photos only under a license that allows CC0 weights.

`uv run license-check` enforces the first two points on `pyproject.toml`, `uv.lock` and every Python file and weight file in the project (outside `.venv/`, `runs/` and `data/`), and exits 1 with a list of findings.

## Setup and checks

```sh
cd training/hole-model
uv sync --locked
uv run license-check && uv run ruff format --check . && uv run ruff check . && uv run mypy && uv run pytest
```

`onnxruntime` is pinned to the `onnxruntime-web` version of the model manifest, so the parity check runs on the app's runtime version.

## Data

The synthetic photos come from the generator of `packages/target-recognition` (run from that folder after `pnpm install` and `pnpm run build`). Holes of 8 to 32 px are half to twice the net's 16 px working size, so a wrongly expected size degrades gently:

```sh
node test/fixtures/target-photos/make-synthetic.mts --out ../../training/hole-model/data/train --seed 1000 --count 3000 --size 256 --diameter 8,32 --holes 0,10
node test/fixtures/target-photos/make-synthetic.mts --out ../../training/hole-model/data/validation --seed 2 --count 200 --size 256 --diameter 8,32 --holes 0,10
node test/fixtures/target-photos/make-synthetic.mts --out ../../training/hole-model/data/test --seed 3 --count 300 --size 256 --diameter 8,32 --holes 0,10
```

An input list maps the splits `train`, `validation`, `test` and `holdout` to label set files (the format of `packages/target-recognition/src/label-set.ts`), with paths relative to the list; `inputs/synthetic.json` lists the three sets above. Training photos are used at their own scale; validation and test photos are scaled so their hole shows at 16 px, as the app does.

The CLI refuses a list in which a photo (by `sha256`) or a session sits in two splits. It reads only the `sha256` and session of holdout photos and never opens a holdout photo or scores it. It checks every photo it opens against its `sha256`.

## Real photos

`convert` turns merged hole marks of real photos (one JSON row per photo: the model's marks in px, the regions with unresolved holes, and the answer of the photo check) into the label sets `train.json` and `validation.json`:

```sh
uv run hole-model convert --labels <merged marks> --posts <corpus images.jsonl> --holdout <holdout folder>... --out data/real
```

| Answer                   | Label                                                                                    |
| ------------------------ | ---------------------------------------------------------------------------------------- |
| `correct`, `correction`  | `real confirmed`: the confirmed or corrected marks                                       |
| `unchecked`, `fix_later` | `real unchecked`: the model's marks, only for photos whose marks are complete or partial |
| `unusable`               | dropped                                                                                  |

- The regions with unresolved holes become `masked` boxes (x, y, width, height in px): the loss and the scores leave them out, so they teach neither hole nor background.
- A photo is dropped when its image or original sha256 matches a holdout photo, it comes from a holdout photo's source post, or its dHash is within 6 bits of a holdout photo's, so a re-encoded or resized copy goes too. Of the holdout folders only the `sha256`, `source_group` and `dhash` of `manifest.json` and the `sha256`, `original_sha256` and `source_group` of `images.jsonl` are read; `convert` refuses a manifest row without a `dhash`.
- The session is the source post. A fixed share of the posts (`--validation-share`, default 0.2, above 0 and below 1, chosen by the hash of the post) forms the validation split, so one post's photos sit in one split.
- Each photo gets the median hole diameter of its marks; a photo without one is dropped.

The `dhash` of each holdout photo is stored once by a step on the holdout side, which opens the holdout photos (`file` of each `manifest.json` row) and writes the hash next to their `sha256`:

```sh
uv run hole-model holdout-dhash --holdout <holdout folder>...
```

The hash is the 64-bit difference hash of the photo after its EXIF rotation, in grayscale at 9 x 8 px (Lanczos): bit 8 x row + column is set where a pixel is brighter than its right neighbor. Target photos of the same face can sit within 6 bits of each other, so the drop also takes some photos that are not copies.

Label set entries may carry `data` (`synthetic` when absent, `real confirmed` or `real unchecked`) and `masked`. Real training photos are scaled so their hole shows at 16 px, as the app does; with `--real-scale-jitter` each drawn real photo shows its hole at a random 8 to 32 px instead, the hole sizes of the synthetic photos. A photo smaller than the crop is edge-padded and the padding masked. An input list for real photos names the synthetic and the real training sets under `train` and only `data/real/validation.json` under `validation`, so the threshold and early stopping use real photos only.

## Train and score

```sh
uv run hole-model train --inputs inputs/synthetic.json --out runs/base --eval-every 0
uv run hole-model score --model runs/base/hole-model.onnx --labels <label set> --threshold <threshold>
```

`--real-share` sets the share of real photos in each batch: 0.5 by default. Of the shares 0, 0.25, 0.5, 0.75 and 1, it has the highest mean F1 score on the real validation split over the seven expected sizes of the wrong-size sweep (0.5 to 2 times the true hole size), each net at its own threshold; `score --believed` gives these scores. Real photos alone (1) score highest at the true size but lose most holes when the app expects half the hole size, as real photos train only at the working size. With `--real-scale-jitter` they keep most holes over the sweep: the mean F1 score of the shares 1, 0.75 and 0.5 is 0.80, 0.79 and 0.74 (0.45, 0.62 and 0.64 without it), at a lower F1 score at the true size. The synthetic test split plays no part in the choice. Every `--eval-every` steps (default 500; 0 keeps the last net, as in the synthetic-only command above) `train` scores the validation split and keeps the net with the best F1 score; it stops after `--patience` checks (default 3) without a better one.

`train` runs on one CPU thread with deterministic algorithms, so the same seed, data and lockfile give the same `scores.json`. It writes to the output folder:

- `hole-model.onnx`: opset 17, input `image` (N x 3 x H x W, RGB in 0..1, H and W multiples of 16), output `heat` (N x 1 x H/2 x W/2 probabilities of a hole center).
- `scores.json`: the git commit (with `-dirty` when anything in this folder is uncommitted), versions (with the `onnxruntime-web` version the parity stands for), seeds, training settings, photo counts per split and data class (`synthetic`, `real confirmed`, `real unchecked`), the real share, the real scale jitter and the early stopping steps, the sha256 of each label set file per split, parameters, file size, the largest ONNX Runtime to PyTorch difference on one validation photo, the threshold with the best F1 score on the validation split, the validation and test recall, precision and corrections (median, 90th percentile from 20 photos, maximum), and the wrong-size sweep: the same scores when the app expects 0.5 to 2 times the true hole size.

`train` exits 1 after writing `scores.json` when ONNX Runtime differs from PyTorch by more than 1e-5 or the ONNX file is larger than 1 MiB.

Scores follow the label set metric of `packages/target-recognition/src/hole-matching.ts`: a peak matches a hole within half a hole diameter, one to one, nearest pairs first; corrections per photo are the larger of false and missed. Only photos marked usable and complete are scored. `runs/` and `data/` are not committed.
