from pathlib import Path

from hole_model.license_check import findings

PROJECT = Path(__file__).parent.parent


def test_the_project_passes() -> None:
    assert findings(PROJECT) == []


def test_a_lockfile_naming_ultralytics_fails() -> None:
    assert findings(PROJECT / "tests" / "fixtures" / "ultralytics-lock") == ["uv.lock: ultralytics"]


def test_a_pyproject_naming_a_banned_package_fails(tmp_path: Path) -> None:
    (tmp_path / "pyproject.toml").write_text(
        '[project]\ndependencies = ["Ultralytics>=8", "torchvision==0.30.0", "timm", "huggingface_hub", "numpy"]\n'
        '[dependency-groups]\ndev = ["safetensors"]\n'
    )
    assert findings(tmp_path) == [
        "pyproject.toml: Ultralytics>=8",
        "pyproject.toml: torchvision==0.30.0",
        "pyproject.toml: timm",
        "pyproject.toml: huggingface_hub",
        "pyproject.toml: safetensors",
    ]


def test_a_lockfile_naming_a_model_zoo_package_fails(tmp_path: Path) -> None:
    names = ("torchvision", "timm", "huggingface-hub", "safetensors", "numpy")
    (tmp_path / "uv.lock").write_text("".join(f'[[package]]\nname = "{n}"\nversion = "1.0"\n' for n in names))
    assert findings(tmp_path) == [
        "uv.lock: huggingface-hub",
        "uv.lock: safetensors",
        "uv.lock: timm",
        "uv.lock: torchvision",
    ]


def test_pretrained_imports_and_checkpoint_loads_fail(tmp_path: Path) -> None:
    (tmp_path / "net.py").write_text(
        "import timm\n"
        "from torchvision import models\n"
        "from torchvision.models import resnet18\n"
        "from ultralytics import YOLO\n"
        "import torchvision.transforms\n"
        "state = torch.load('foreign.pt')\n"
        "torch.hub.load_state_dict_from_url('https://example.org/w.pth')\n"
    )
    (tmp_path / "foreign.pt").write_bytes(b"")
    assert findings(tmp_path) == [
        "foreign.pt: a weight file; the project only writes its own to runs/",
        "net.py:1: timm",
        "net.py:2: torchvision.models",
        "net.py:3: torchvision.models",
        "net.py:4: ultralytics",
        "net.py:6: torch.load",
        "net.py:7: load_state_dict_from_url()",
        "net.py:7: torch.hub",
    ]


def test_model_zoo_use_after_a_plain_import_or_an_alias_fails(tmp_path: Path) -> None:
    (tmp_path / "net.py").write_text(
        "import torch\n"
        "import torchvision\n"
        'm = torch.hub.load("ultralytics/yolov5", "yolov5s")\n'
        'r = torchvision.models.resnet18(weights="DEFAULT")\n'
        "import torch as t\n"
        "import torchvision.models as tvm\n"
        "from torch import load as read\n"
        "t.hub.list('x')\n"
        "tvm.vgg11()\n"
        "read('w')\n"
        "t.onnx.export\n"
    )
    assert findings(tmp_path) == [
        "net.py:3: torch.hub",
        "net.py:4: torchvision.models",
        "net.py:6: torchvision.models",
        "net.py:7: torch.load",
        "net.py:8: torch.hub",
        "net.py:9: torchvision.models",
        "net.py:10: torch.load",
    ]


def test_an_alias_from_any_scope_resolves_to_every_module_it_names(tmp_path: Path) -> None:
    (tmp_path / "net.py").write_text(
        "import torch as t\ndef wait():\n    import time as t\n    t.sleep(1)\nt.load('data/foreign.pt')\n"
    )
    assert findings(tmp_path) == ["net.py:5: torch.load"]


def test_an_aliased_checkpoint_download_fails(tmp_path: Path) -> None:
    (tmp_path / "net.py").write_text(
        "import torch\n"
        "from torch.utils.model_zoo import load_url as download\n"
        "download('https://example.org/w.pth')\n"
        "torch.onnx.export\n"
    )
    assert findings(tmp_path) == ["net.py:3: load_url()"]


def test_weight_files_fail_in_any_case_and_container(tmp_path: Path) -> None:
    for name in ("w.PT", "w.npz", "w.bin", "w.npy", "w.pkl", "notes.txt"):
        (tmp_path / name).write_bytes(b"")
    assert findings(tmp_path) == [
        f"{n}: a weight file; the project only writes its own to runs/"
        for n in ("w.PT", "w.bin", "w.npy", "w.npz", "w.pkl")
    ]


def test_only_the_untracked_project_folders_are_skipped(tmp_path: Path) -> None:
    for folder in ("data", "runs", ".venv", "src/data", "src/runs"):
        (tmp_path / folder).mkdir(parents=True)
        (tmp_path / folder / "net.py").write_text("import ultralytics\n")
    assert findings(tmp_path) == ["src/data/net.py:1: ultralytics", "src/runs/net.py:1: ultralytics"]
