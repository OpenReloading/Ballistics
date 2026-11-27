# Hole model provenance

| File                    | SHA-256                                                            | Bytes   |
| ----------------------- | ------------------------------------------------------------------ | ------- |
| `hole-model-0.1.0.onnx` | `43631bba97d43f2cc838dab83ec024a24f39c0ef687a7d8b1cf0763cbbf8a023` | 792,640 |

The file is the `hole-model.onnx` that `uv run hole-model train` writes in `training/hole-model` (its README, "Train and score"), copied here under the versioned name. The manifest beside it (`hole-model-<version>.json`) holds the same `sha256` and `bytes`, and the app refuses a model file that differs from them.

Check a file: `shasum -a 256 hole-model-0.1.0.onnx`.
