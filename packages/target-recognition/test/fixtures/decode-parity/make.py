"""Writes dark-disks.onnx, a fixed-weight net in the hole model's ONNX contract, and prints the hole centers that the
training project's scoring finds with it on the photo of decode-parity.test.ts; run from training/hole-model:
uv run python ../../packages/target-recognition/test/fixtures/decode-parity/make.py"""

import json
from pathlib import Path

import numpy as np
import torch
from torch import nn

from hole_model.scoring import find, onnx_heat, single_thread_session

WIDTH, HEIGHT, RADIUS = 70, 50, 8
# each center lies on a heatmap cell center, so the decoders' cell conventions differ by half a working px only
CENTERS = [(20.5, 24.5), (50.5, 16.5), (40.5, 38.5)]
THRESHOLD = 0.35


class DarkDisks(nn.Module):
    """Darkness, averaged to stride 2, matched against a Gaussian of the hole's size; a hole center gives one peak."""

    def __init__(self) -> None:
        super().__init__()
        self.pool = nn.AvgPool2d(2)
        self.blur = nn.Conv2d(1, 1, 9, padding=4, bias=False)
        g = torch.exp(-(torch.arange(9, dtype=torch.float32) - 4) ** 2 / (2 * 2.5**2))
        kernel = g[:, None] * g[None, :]
        with torch.no_grad():
            self.blur.weight.copy_((kernel / kernel.sum())[None, None])

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        dark = 1 - x.mean(1, keepdim=True)
        return torch.sigmoid(8 * (self.blur(self.pool(dark)) - 0.5))


def photo() -> np.ndarray:
    """White RGB with black disks, the pixel centers within RADIUS of a center inside."""
    y, x = np.mgrid[0:HEIGHT, 0:WIDTH]
    dark = np.zeros((HEIGHT, WIDTH), bool)
    for cx, cy in CENTERS:
        dark |= (x - cx) ** 2 + (y - cy) ** 2 <= RADIUS**2
    return np.repeat(np.where(dark, 0, 255).astype(np.uint8)[..., None], 3, axis=2)


def main() -> None:
    out = Path(__file__).with_name("dark-disks.onnx")
    net = DarkDisks().eval()
    torch.onnx.export(
        net,
        (torch.zeros(1, 3, 16, 16),),
        str(out),
        input_names=["image"],
        output_names=["heat"],
        opset_version=17,
        dynamic_axes={"image": {0: "n", 2: "h", 3: "w"}, "heat": {0: "n", 2: "h2", 3: "w2"}},
        dynamo=False,
    )
    heat = onnx_heat(single_thread_session(str(out)))
    print(json.dumps([[round(x, 3), round(y, 3)] for x, y in find(heat, photo(), 2 * RADIUS, THRESHOLD)]))


if __name__ == "__main__":
    main()
