"""Fails when the project could taint its CC0 weights: Ultralytics, a pretrained model zoo or a foreign checkpoint.

Usage: license-check [project folder]. Exit 1 lists every finding.
"""

import ast
import re
import sys
import tomllib
from pathlib import Path

# Ultralytics' license covers models trained from scratch with its code (https://www.ultralytics.com/license)
BANNED_PACKAGES = {"ultralytics"}
# the project trains from random weights and never needs to read a checkpoint
BANNED_IMPORTS = (
    *("ultralytics", "timm", "torchvision.models", "torch.hub", "huggingface_hub", "safetensors"),
    *("torch.load", "torch.jit.load"),
)
BANNED_CALLS = {"torch.load", "torch.jit.load"}
BANNED_CALL_NAMES = {"load_state_dict_from_url", "load_url", "from_pretrained", "hf_hub_download"}
WEIGHT_SUFFIXES = {".pt", ".pth", ".ckpt", ".safetensors", ".onnx", ".tflite", ".h5", ".pb"}
SKIPPED_DIRS = {".venv", "runs", "data", "__pycache__", ".pytest_cache", ".mypy_cache", ".ruff_cache"}


def _requirement_name(requirement: str) -> str:
    match = re.match(r"\s*([A-Za-z0-9._-]+)", requirement)
    return match.group(1).lower() if match else ""


def manifest_findings(root: Path) -> list[str]:
    """Banned packages named in pyproject.toml or uv.lock."""
    found = []
    pyproject = root / "pyproject.toml"
    if pyproject.exists():
        project = tomllib.loads(pyproject.read_text())
        requirements = [*project.get("project", {}).get("dependencies", [])]
        for group in project.get("dependency-groups", {}).values():
            requirements += [r for r in group if isinstance(r, str)]
        for extra in project.get("project", {}).get("optional-dependencies", {}).values():
            requirements += extra
        found += [f"pyproject.toml: {r}" for r in requirements if _requirement_name(r) in BANNED_PACKAGES]
    lock = root / "uv.lock"
    if lock.exists():
        names = {p.get("name", "").lower() for p in tomllib.loads(lock.read_text()).get("package", [])}
        found += [f"uv.lock: {n}" for n in sorted(names & BANNED_PACKAGES)]
    return found


def _dotted(node: ast.expr) -> str:
    if isinstance(node, ast.Name):
        return node.id
    if isinstance(node, ast.Attribute):
        return f"{_dotted(node.value)}.{node.attr}"
    return ""


def _banned_module(name: str) -> bool:
    return any(name == b or name.startswith(f"{b}.") for b in BANNED_IMPORTS)


def source_findings(path: Path, source: str) -> list[str]:
    """Banned imports and checkpoint loads in one Python file."""
    found = []
    for node in ast.walk(ast.parse(source, str(path))):
        if isinstance(node, ast.Import):
            found += [f"{path}:{node.lineno}: import {a.name}" for a in node.names if _banned_module(a.name)]
        elif isinstance(node, ast.ImportFrom) and node.module:
            names = [node.module, *(f"{node.module}.{a.name}" for a in node.names)]
            if any(_banned_module(n) for n in names):
                found.append(f"{path}:{node.lineno}: from {node.module} import")
        elif isinstance(node, ast.Call):
            call = _dotted(node.func)
            if call in BANNED_CALLS or call.rsplit(".", 1)[-1] in BANNED_CALL_NAMES:
                found.append(f"{path}:{node.lineno}: {call}()")
    return found


def findings(root: Path) -> list[str]:
    found = manifest_findings(root)
    for path in sorted(root.rglob("*")):
        if SKIPPED_DIRS & set(path.relative_to(root).parts):
            continue
        if path.suffix in WEIGHT_SUFFIXES:
            found.append(f"{path.relative_to(root)}: a weight file; the project only writes its own to runs/")
        elif path.suffix == ".py":
            found += source_findings(path.relative_to(root), path.read_text())
    return found


def main() -> None:
    root = Path(sys.argv[1] if len(sys.argv) > 1 else ".")
    found = findings(root)
    for f in found:
        print(f"license-check: {f}", file=sys.stderr)
    sys.exit(1 if found else 0)
