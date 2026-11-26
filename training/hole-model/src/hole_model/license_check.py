"""Fails when the project could taint its CC-BY-SA-4.0 weights: Ultralytics, a pretrained model zoo or a foreign checkpoint.

Usage: license-check [project folder]. Exit 1 lists every finding.
"""

import ast
import re
import sys
import tomllib
from pathlib import Path

# Ultralytics' license covers models trained from scratch (https://www.ultralytics.com/license); the others ship weights
BANNED_PACKAGES = {"ultralytics", "torchvision", "timm", "huggingface-hub", "safetensors"}
# the project trains from random weights and never needs to read a checkpoint
BANNED_NAMES = (
    *("ultralytics", "timm", "torchvision.models", "torch.hub", "huggingface_hub", "safetensors"),
    *("torch.load", "torch.jit.load"),
)
BANNED_CALL_NAMES = {"load_state_dict_from_url", "load_url", "from_pretrained", "hf_hub_download"}
WEIGHT_SUFFIXES = {
    ".pt",
    ".pth",
    ".ckpt",
    ".safetensors",
    ".onnx",
    ".tflite",
    ".h5",
    ".pb",
    ".npz",
    ".npy",
    ".bin",
    ".pkl",
}
# untracked project folders (see .gitignore); a folder of the same name elsewhere is still checked
SKIPPED_ROOT_DIRS = {".venv", "runs", "data"}
CACHE_DIRS = {"__pycache__", ".pytest_cache", ".mypy_cache", ".ruff_cache"}


def _package_name(requirement: str) -> str:
    """The normalized name (PEP 503) of a requirement or lockfile package."""
    match = re.match(r"\s*([A-Za-z0-9._-]+)", requirement)
    return re.sub(r"[-_.]+", "-", match.group(1)).lower() if match else ""


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
        found += [f"pyproject.toml: {r}" for r in requirements if _package_name(r) in BANNED_PACKAGES]
    lock = root / "uv.lock"
    if lock.exists():
        names = {_package_name(p.get("name", "")) for p in tomllib.loads(lock.read_text()).get("package", [])}
        found += [f"uv.lock: {n}" for n in sorted(names & BANNED_PACKAGES)]
    return found


def _dotted(node: ast.expr) -> str:
    if isinstance(node, ast.Name):
        return node.id
    if isinstance(node, ast.Attribute) and (base := _dotted(node.value)):
        return f"{base}.{node.attr}"
    return ""


def _banned(name: str) -> str | None:
    return next((b for b in BANNED_NAMES if name == b or name.startswith(f"{b}.")), None)


def _imported_names(tree: ast.Module) -> dict[str, set[str]]:
    """Every full name each imported local name stands for in any scope of the file, so that aliases resolve."""
    names: dict[str, set[str]] = {}
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for a in node.names:
                local = a.asname or a.name.split(".")[0]
                names.setdefault(local, set()).add(a.name if a.asname else local)
        elif isinstance(node, ast.ImportFrom) and node.module and not node.level:
            for a in node.names:
                names.setdefault(a.asname or a.name, set()).add(f"{node.module}.{a.name}")
    return names


def _resolved(dotted: str, imported: dict[str, set[str]]) -> set[str]:
    head, _, rest = dotted.partition(".")
    return {".".join(filter(None, (full, rest))) for full in imported.get(head, {head})}


def source_findings(path: Path, source: str) -> list[str]:
    """Imports of and references to banned modules, aliases included, and checkpoint loads in one Python file."""
    tree = ast.parse(source, str(path))
    imported = _imported_names(tree)
    found: set[tuple[int, str]] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Import | ast.ImportFrom):
            modules = [a.name for a in node.names] if isinstance(node, ast.Import) else []
            if isinstance(node, ast.ImportFrom) and node.module and not node.level:
                modules = [node.module, *(f"{node.module}.{a.name}" for a in node.names)]
            found |= {(node.lineno, b) for m in modules if (b := _banned(m))}
        elif isinstance(node, ast.Name | ast.Attribute) and (dotted := _dotted(node)):
            found |= {(node.lineno, b) for full in _resolved(dotted, imported) if (b := _banned(full))}
        if isinstance(node, ast.Call) and isinstance(node.func, ast.Name | ast.Attribute):
            name = node.func.id if isinstance(node.func, ast.Name) else node.func.attr
            dotted = _dotted(node.func)
            names = {name, *(full.rpartition(".")[2] for full in (_resolved(dotted, imported) if dotted else ()))}
            found |= {(node.lineno, f"{n}()") for n in names & BANNED_CALL_NAMES}
    return [f"{path}:{line}: {name}" for line, name in sorted(found)]


def findings(root: Path) -> list[str]:
    found = manifest_findings(root)
    for folder, dirs, files in root.walk():
        dirs[:] = sorted(d for d in dirs if d not in CACHE_DIRS and not (folder == root and d in SKIPPED_ROOT_DIRS))
        for name in sorted(files):
            path = folder / name
            if path.suffix.lower() in WEIGHT_SUFFIXES:
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
