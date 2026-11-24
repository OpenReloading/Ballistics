"""The U-shaped heatmap net: RGB in, one hole center probability per 2 x 2 px out."""

from collections.abc import Sequence
from typing import cast

import numpy as np
import numpy.typing as npt
import torch
import torch.nn.functional as F  # noqa: N812
from torch import nn

STRIDE = 2
HOLE_PX = 16
SIZE_MULTIPLE = 16
BASE_WIDTHS = (16, 32, 48, 64)


class Block(nn.Module):
    """A plain 3 x 3 convolution: on a CPU it trains about twice as fast as a depthwise separable block."""

    def __init__(self, i: int, o: int, stride: int = 1) -> None:
        super().__init__()
        self.conv = nn.Conv2d(i, o, 3, stride, 1, bias=False)
        self.bn = nn.BatchNorm2d(o)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return F.relu(self.bn(self.conv(x)))


class HoleNet(nn.Module):
    """Strides 2 to 16 with skip connections; the output is at stride 2."""

    def __init__(self, c: Sequence[int] = BASE_WIDTHS) -> None:
        super().__init__()
        self.stem = nn.Sequential(Block(3, c[0], 2), Block(c[0], c[0]))
        self.d1 = nn.Sequential(Block(c[0], c[1], 2), Block(c[1], c[1]))
        self.d2 = nn.Sequential(Block(c[1], c[2], 2), Block(c[2], c[2]))
        self.d3 = nn.Sequential(Block(c[2], c[3], 2), Block(c[3], c[3]))
        self.u2 = Block(c[3] + c[2], c[2])
        self.u1 = Block(c[2] + c[1], c[1])
        self.u0 = nn.Sequential(Block(c[1] + c[0], c[0]), Block(c[0], c[0]))
        self.head = nn.Conv2d(c[0], 1, 1)
        # a start probability of 0.1, as CenterNet sets it, keeps the early focal loss small
        nn.init.constant_(cast(torch.Tensor, self.head.bias), -2.19)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """x: N x 3 x H x W in 0..1, H and W multiples of 16; returns N x 1 x H/2 x W/2 probabilities."""
        e0 = self.stem(x - 0.5)
        e1 = self.d1(e0)
        e2 = self.d2(e1)
        e3 = self.d3(e2)
        y = self.u2(torch.cat([F.interpolate(e3, scale_factor=2.0, mode="nearest"), e2], 1))
        y = self.u1(torch.cat([F.interpolate(y, scale_factor=2.0, mode="nearest"), e1], 1))
        y = self.u0(torch.cat([F.interpolate(y, scale_factor=2.0, mode="nearest"), e0], 1))
        return torch.sigmoid(self.head(y))


def input_array(rgb: npt.NDArray[np.uint8]) -> npt.NDArray[np.float32]:
    """H x W x 3 uint8 as the net's 1 x 3 x H' x W' input in 0..1, edge-padded to the size multiple."""
    h, w = rgb.shape[:2]
    # edge padding adds no border that looks like a hole's rim
    x = np.pad(rgb, ((0, (-h) % SIZE_MULTIPLE), (0, (-w) % SIZE_MULTIPLE), (0, 0)), mode="edge")
    return np.ascontiguousarray(x.transpose(2, 0, 1)[None] / 255, dtype=np.float32)


def target(holes: npt.NDArray[np.float32], diameter: float, height: int, width: int) -> npt.NDArray[np.float32]:
    """The Gaussian heatmap at the output stride of one photo, exactly 1 at each hole's nearest cell."""
    h, w = height // STRIDE, width // STRIDE
    out = np.zeros((h, w), np.float32)
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    sigma = max(0.8, 0.09 * diameter)
    for x, y in holes:
        cx, cy = x / STRIDE, y / STRIDE
        g = np.exp(-((xx - cx) ** 2 + (yy - cy) ** 2) / (2 * sigma * sigma))
        g[min(h - 1, round(cy)), min(w - 1, round(cx))] = 1.0
        np.maximum(out, g, out=out)
    return out


def focal_loss(p: torch.Tensor, t: torch.Tensor) -> torch.Tensor:
    """The penalty-reduced focal loss of CenterNet (Zhou et al., Objects as Points, https://arxiv.org/abs/1904.07850)."""
    p = p.clamp(1e-5, 1 - 1e-5)
    pos = (t >= 0.999).float()
    loss = -(pos * (1 - p) ** 2 * torch.log(p) + (1 - pos) * (1 - t) ** 4 * p**2 * torch.log(1 - p))
    return loss.sum() / pos.sum().clamp(min=1.0)


def peaks(heat: npt.NDArray[np.float32], threshold: float) -> list[tuple[float, float]]:
    """Local 3 x 3 maxima at or above `threshold` as x, y in input px, each the centroid of its 3 x 3 cells."""
    h = torch.from_numpy(heat)[None, None]
    keep = (F.max_pool2d(h, 3, 1, 1) == h) & (h >= threshold)
    out = []
    for y, x in keep[0, 0].nonzero().tolist():
        y0, y1, x0, x1 = max(0, y - 1), min(heat.shape[0], y + 2), max(0, x - 1), min(heat.shape[1], x + 2)
        cells = heat[y0:y1, x0:x1]
        gy, gx = np.mgrid[y0:y1, x0:x1]
        out.append((float((cells * gx).sum() / cells.sum() * STRIDE), float((cells * gy).sum() / cells.sum() * STRIDE)))
    return out
