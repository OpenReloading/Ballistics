from pathlib import Path

from hole_model.license_check import findings

PROJECT = Path(__file__).parent.parent


def test_the_project_passes() -> None:
    assert findings(PROJECT) == []


def test_a_lockfile_naming_ultralytics_fails() -> None:
    assert findings(PROJECT / "tests" / "fixtures" / "ultralytics-lock") == ["uv.lock: ultralytics"]


def test_a_pyproject_naming_ultralytics_fails(tmp_path: Path) -> None:
    (tmp_path / "pyproject.toml").write_text('[project]\ndependencies = ["Ultralytics>=8"]\n')
    assert findings(tmp_path) == ["pyproject.toml: Ultralytics>=8"]


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
        "net.py:1: import timm",
        "net.py:2: from torchvision import",
        "net.py:3: from torchvision.models import",
        "net.py:4: from ultralytics import",
        "net.py:6: torch.load()",
        "net.py:7: torch.hub.load_state_dict_from_url()",
    ]
