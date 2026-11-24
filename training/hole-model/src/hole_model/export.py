"""ONNX export with a free batch, height and width, and the parity check against PyTorch."""

from pathlib import Path

import numpy as np
import numpy.typing as npt
import torch

from hole_model.net import HoleNet
from hole_model.scoring import single_thread_session

OPSET = 17


def export(net: HoleNet, path: Path, sample: npt.NDArray[np.float32]) -> float:
    """Writes the net to `path` and returns the largest absolute difference of ONNX Runtime to PyTorch on `sample`."""
    net.eval()
    x = torch.from_numpy(sample)
    torch.onnx.export(
        net,
        (x,),
        str(path),
        input_names=["image"],
        output_names=["heat"],
        opset_version=OPSET,
        dynamic_axes={"image": {0: "n", 2: "h", 3: "w"}, "heat": {0: "n", 2: "h2", 3: "w2"}},
        # the TorchScript exporter needs no onnxscript and writes a single file without external data
        dynamo=False,
    )
    with torch.no_grad():
        ref = net(x).numpy()
    got = single_thread_session(str(path)).run(None, {"image": sample})[0]
    return float(np.abs(ref - got).max())
