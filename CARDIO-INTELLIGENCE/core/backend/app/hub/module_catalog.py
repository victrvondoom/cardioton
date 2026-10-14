"""Catalog of the cardiovascular projects absorbed into CARDIO INTELLIGENCE.

Every project lives under ``CARDIO-INTELLIGENCE/modules/<slug>/``. This module reads what each
one actually contains (README, features, screenshots, 3D anatomy, evaluation metrics, datasets,
notebooks, run commands) so the product can present all of them in one place. Nothing is
invented: a module without screenshots simply has none listed.

The scan is cached for the life of the process; ``refresh_catalog()`` rebuilds it.
"""

from __future__ import annotations

import csv
import html
import json
import os
import re
from collections import Counter
from collections.abc import Iterator
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path
from typing import Any

# CARDIO-INTELLIGENCE/core/backend/app/hub/module_catalog.py -> parents[4] is CARDIO-INTELLIGENCE
_DEFAULT_MODULES_ROOT = Path(__file__).resolve().parents[4] / "modules"

SKIP_DIRS = {
    "node_modules", ".venv", "venv", "__pycache__", ".git", ".next", ".expo", ".pytest_cache",
    ".mypy_cache", ".ruff_cache", ".hub-build",
}
IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"}
MODEL3D_EXTS = {".glb", ".gltf", ".stl", ".obj", ".ply"}
DATASET_EXTS = {".csv", ".tsv"}
ML_MODEL_EXTS = {".joblib", ".pkl", ".pickle", ".pt", ".pth", ".onnx", ".h5", ".keras", ".safetensors"}
SERVABLE_EXTS = IMAGE_EXTS | MODEL3D_EXTS | DATASET_EXTS | {".json", ".md", ".txt", ".pdf", ".bin"}
MAX_SERVE_BYTES = 80 * 1024 * 1024
SECRET_NAME = re.compile(
    r"^(\.env(\..+)?|.+\.(pem|key|p12|pfx|keystore|jks)|id_(rsa|dsa|ecdsa|ed25519).*|.*credentials.*\.json"
    r"|service-account.*\.json)$",
    re.IGNORECASE,
)
METRIC_FILE = re.compile(r"(metric|result|evaluation|report|score|performance|summary)", re.IGNORECASE)
METRIC_KEY = re.compile(
    r"(^|_)(auc|roc_auc|auroc|auprc|accuracy|acc|balanced_accuracy|f1|precision|recall|sensitivity|"
    r"specificity|brier|mae|rmse|r2|dice|iou|ppv|npv|kappa|mcc)(_|$)",
    re.IGNORECASE,
)

CATEGORIES = (
    "Risk Prediction",
    "3D Anatomy & Visualization",
    "Digital Twins & Hemodynamics",
    "Imaging & Signals",
    "Clinical AI & Workflow",
)

# Curated primary category per known project; unknown projects fall back to keyword scoring.
CURATED_CATEGORY = {
    "aortavision-3d": "3D Anatomy & Visualization",
    "arterylens": "Risk Prediction",
    "axxess": "Clinical AI & Workflow",
    "cad-detection-3d-heart": "3D Anatomy & Visualization",
    "cardia-atlas": "3D Anatomy & Visualization",
    "cardio": "Risk Prediction",
    "cardio-inspection": "Risk Prediction",
    "cardio-risk-3d": "Risk Prediction",
    "cardio-risk-heart-3d": "Risk Prediction",
    "cardiolens-track-a": "Risk Prediction",
    "cardioscope": "3D Anatomy & Visualization",
    "cardiosight-3d": "3D Anatomy & Visualization",
    "cardiospatial-3d": "3D Anatomy & Visualization",
    "cardiotwin": "Digital Twins & Hemodynamics",
    "cardiovascular-risk-viz-and-prediction": "Digital Twins & Hemodynamics",
    "cardiovision-3d": "Risk Prediction",
    "case-twin": "Clinical AI & Workflow",
    "corolens": "Risk Prediction",
    "coronarytwin": "Digital Twins & Hemodynamics",
    "cortwin": "Digital Twins & Hemodynamics",
    "cv-risk-viz-prediction": "Risk Prediction",
    "epicast": "Clinical AI & Workflow",
    "grok-app": "Clinical AI & Workflow",
    "hack-ireland-2025": "Clinical AI & Workflow",
    "heartai": "Imaging & Signals",
    "hophacks": "Clinical AI & Workflow",
    "multimodal-ai-hackathon-project": "Risk Prediction",
    "multimodal-hackathon-2026": "Risk Prediction",
    "multimodal-hackathon-track-a": "Risk Prediction",
    "safetyconnect": "Clinical AI & Workflow",
    "slicerheart": "Imaging & Signals",
}
CATEGORY_KEYWORDS = {
    "Risk Prediction": ("risk", "prediction", "stenosis", "cad", "classifier", "probability"),
    "3D Anatomy & Visualization": ("3d", "anatomy", "mesh", "three.js", "webgl", "visualization"),
    "Digital Twins & Hemodynamics": ("twin", "hemodynamic", "perfusion", "ffr", "flow"),
    "Imaging & Signals": ("ecg", "mri", "ct ", "imaging", "echo", "dicom", "nifti", "slicer"),
    "Clinical AI & Workflow": ("agent", "llm", "workflow", "scribe", "billing", "surveillance", "triage"),
}

JS_TECH = {
    "react": "React", "next": "Next.js", "vite": "Vite", "three": "Three.js", "@react-three/fiber": "React Three Fiber",
    "expo": "Expo / React Native", "tailwindcss": "Tailwind", "typescript": "TypeScript", "d3": "D3",
    "recharts": "Recharts", "plotly.js": "Plotly", "maplibre-gl": "MapLibre", "inngest": "Inngest",
    "@supabase/supabase-js": "Supabase", "openai": "OpenAI", "@anthropic-ai/sdk": "Anthropic",
}
PY_TECH = {
    "fastapi": "FastAPI", "flask": "Flask", "streamlit": "Streamlit", "gradio": "Gradio", "torch": "PyTorch",
    "tensorflow": "TensorFlow", "scikit-learn": "scikit-learn", "sklearn": "scikit-learn", "xgboost": "XGBoost",
    "lightgbm": "LightGBM", "pandas": "pandas", "numpy": "NumPy", "monai": "MONAI", "nibabel": "NiBabel",
    "pydicom": "pydicom", "langchain": "LangChain", "openai": "OpenAI", "anthropic": "Anthropic",
    "qdrant-client": "Qdrant", "shap": "SHAP", "trimesh": "trimesh", "vtk": "VTK",
}


@dataclass
class ModuleRecord:
    slug: str
    root: Path
    title: str
    tagline: str
    category: str
    readme_path: str | None
    readme: str
    features: list[str]
    tech: list[str]
    images: list[dict[str, Any]]
    models3d: list[dict[str, Any]]
    datasets: list[dict[str, Any]]
    notebooks: list[dict[str, Any]]
    ml_models: list[dict[str, Any]]
    metrics: list[dict[str, Any]]
    run_commands: list[str]
    languages: dict[str, int]
    files_total: int
    hero_image: str | None
    live_app: bool
    extra: dict[str, Any] = field(default_factory=dict)

    def summary(self) -> dict[str, Any]:
        return {
            "slug": self.slug,
            "title": self.title,
            "tagline": self.tagline,
            "category": self.category,
            "tech": self.tech,
            "hero_image": self.hero_image,
            "live_app": self.live_app,
            "features": self.features[:4],
            "counts": {
                "files": self.files_total,
                "images": len(self.images),
                "models3d": len(self.models3d),
                "datasets": len(self.datasets),
                "notebooks": len(self.notebooks),
                "ml_models": len(self.ml_models),
                "metrics": len(self.metrics),
                "features": len(self.features),
            },
        }

    def detail(self) -> dict[str, Any]:
        data = self.summary()
        data.update(
            readme=self.readme,
            readme_path=self.readme_path,
            features=self.features,
            images=self.images,
            models3d=self.models3d,
            datasets=self.datasets,
            notebooks=self.notebooks,
            ml_models=self.ml_models,
            metrics=self.metrics,
            run_commands=self.run_commands,
            languages=self.languages,
        )
        return data


def modules_root() -> Path:
    override = os.environ.get("CARDIO_MODULES_ROOT")
    return Path(override) if override else _DEFAULT_MODULES_ROOT


def live_app_dir(slug: str) -> Path:
    """Where a module's built web app is placed for embedding (generated, git-ignored)."""
    return modules_root() / slug / ".hub-build"


def _walk(root: Path) -> Iterator[Path]:
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = sorted(d for d in dirnames if d not in SKIP_DIRS)
        for name in sorted(filenames):
            yield Path(dirpath) / name


def _rel(root: Path, path: Path) -> str:
    return path.relative_to(root).as_posix()


_LATEX = {r"\geq": "≥", r"\ge": "≥", r"\leq": "≤", r"\le": "≤", r"\%": "%", r"\times": "×", r"\pm": "±",
          r"\approx": "≈"}


def _inline_math(expr: str) -> str:
    for command, symbol in _LATEX.items():
        expr = expr.replace(command, symbol)
    return re.sub(r"[\\{}]", "", expr).strip()


def _strip_markdown(text: str) -> str:
    text = re.sub(r"\$([^$]{1,40})\$", lambda m: _inline_math(m.group(1)), text)
    text = re.sub(r"!\[[^\]]*\]\([^)]*\)", "", text)
    text = re.sub(r"\[([^\]]+)\]\([^)]*\)", r"\1", text)
    text = re.sub(r"<[^>]+>", "", text)
    text = re.sub(r"[*_`~]+", "", text)
    text = re.sub(r":[a-z_]+:", "", text)
    return re.sub(r"\s+", " ", html.unescape(text)).strip()


def _readme_file(root: Path) -> Path | None:
    """The module's top-level README, else one in an app subfolder (web/, frontend/, …)."""
    def readmes(folder: Path) -> list[Path]:
        return sorted(p for p in folder.iterdir() if p.is_file() and p.name.lower().endswith("readme.md"))

    found = readmes(root)
    if found:
        return found[0]
    subfolders = sorted((p for p in root.iterdir() if p.is_dir() and p.name not in SKIP_DIRS),
                        key=lambda p: (p.name.lower() not in ("web", "frontend", "app", "src", "client"), p.name))
    for folder in subfolders:
        found = readmes(folder)
        if found:
            return found[0]
    return None


def _package_description(root: Path) -> str:
    for path in [root / "package.json", *sorted(root.glob("*/package.json"))]:
        try:
            description = json.loads(path.read_text(encoding="utf-8")).get("description", "")
        except (OSError, ValueError):
            continue
        if isinstance(description, str) and len(description) > 20:
            return description.strip()
    return ""


_NON_PROSE = re.compile(r"^(#|!\[|\[!|<|\||---|___|\*\*\*|>|[-*+]\s|\d+[.)]\s)")
_NOT_A_TAGLINE = re.compile(
    r"^(to run|run |install|clone|git |npm |pip |cd |docker|open |visit |navigate|go to |see |note\b|tip\b|"
    r"warning\b|this project is licensed|licensed under|copyright|this is a next\.js project|this project uses next/font|you can |"
    r"for (decision support|educational|research)[\w ]* (use|purposes))", re.IGNORECASE)
_URL = re.compile(r"https?://|localhost|127\.0\.0\.1")
_LABEL = re.compile(r"(?:^|\s)[A-Z][\w-]*(?: [\w()-]+){0,2}:\s")
_NAMED_SUBJECT = re.compile(r"^([A-Z][\w.+-]*(?: [A-Z][\w.+-]*){0,2}) (?:is|are) (?:an?|the)\b")


def _is_tagline(text: str) -> bool:
    """A sentence describing the project, not an instruction, link, license line or metadata block."""
    return (len(text) >= 45 and len(text.split()) >= 7 and not text.endswith(":") and not text[:1].islower()
            and not _URL.search(text) and not _NOT_A_TAGLINE.match(text) and len(_LABEL.findall(text)) < 2)


def _is_banner(text: str) -> bool:
    """A short event or track banner ("Multimodal AI Hackathon 2026 · Track A …") rather than a description."""
    return len(text.split()) < 12 or bool(re.match(r"^(track [a-z]\b|multimodal ai hackathon)", text, re.IGNORECASE))


def _title_and_tagline(readme: str, slug: str) -> tuple[str, str]:
    """The first H1 and the first descriptive prose paragraph after it (wrapped lines joined)."""
    title, in_fence = "", False
    paragraphs: list[tuple[bool, str]] = []
    buffer: list[str] = []

    def flush() -> None:
        if buffer:
            paragraphs.append((bool(title), " ".join(buffer)))
            buffer.clear()

    for line in readme.splitlines():
        stripped = line.strip()
        if stripped.startswith(("```", "~~~")):
            flush()
            in_fence = not in_fence
            continue
        if in_fence:
            continue
        html_h1 = re.search(r"<h1[^>]*>(.*?)</h1>", stripped, re.IGNORECASE)
        if not title and (re.match(r"^#\s", stripped) or html_h1):
            flush()
            title = _strip_markdown(html_h1.group(1) if html_h1 else stripped.lstrip("#"))
            continue
        if not stripped or _NON_PROSE.match(stripped):
            flush()
            continue
        buffer.append(stripped)
    flush()
    # Everything after the create-next-app template text is template boilerplate, not the project.
    boilerplate = next((i for i, (_, text) in enumerate(paragraphs) if "bootstrapped with" in text.lower()), None)
    paragraphs = paragraphs[:boilerplate]
    candidates = [text for text in (_strip_markdown(text) for after_title, text in paragraphs if after_title or not title)
                  if _is_tagline(text)]
    tagline = next((text for text in candidates if not _is_banner(text)), candidates[0] if candidates else "")
    if not title:
        named = _NAMED_SUBJECT.match(tagline)
        subject = named.group(1) if named else ""
        title = subject if subject and subject.split()[0] not in {"This", "It", "The", "We", "Our", "There"} \
            else slug.replace("-", " ").title()
    if len(tagline) > 220:
        tagline = tagline[:217].rsplit(" ", 1)[0] + "…"
    return title[:90], tagline


def _features(readme: str) -> list[str]:
    """Bullet points under a features-like heading, else the first bullet list."""
    sections: list[tuple[str, list[str]]] = []
    heading, in_fence = "", False
    bullets: list[str] = []
    for line in readme.splitlines():
        stripped = line.strip()
        if stripped.startswith(("```", "~~~")):
            in_fence = not in_fence
            continue
        if in_fence:
            continue
        if stripped.startswith("#"):
            if bullets:
                sections.append((heading, bullets))
            heading, bullets = stripped.lstrip("#").strip().lower(), []
            continue
        bullet = re.match(r"^(?:[-*+]|\d+[.)])\s+(.*)$", stripped)
        if bullet:
            text = _strip_markdown(bullet.group(1))
            if 8 <= len(text) <= 220:
                bullets.append(text)
    if bullets:
        sections.append((heading, bullets))
    preferred = re.compile(r"feature|capabilit|highlight|what (it|this) does|key|overview|includes|demo")
    for heading_text, items in sections:
        if preferred.search(heading_text):
            return items[:12]
    return sections[0][1][:12] if sections else []


def _tech(files: list[Path]) -> list[str]:
    found: Counter[str] = Counter()
    for path in files:
        name = path.name.lower()
        if name == "package.json":
            try:
                data = json.loads(path.read_text(encoding="utf-8"))
            except (OSError, ValueError):
                continue
            deps = set(data.get("dependencies", {})) | set(data.get("devDependencies", {}))
            for key, label in JS_TECH.items():
                if key in deps:
                    found[label] += 1
        elif name == "pyproject.toml" or name.startswith("requirements"):
            try:
                text = path.read_text(encoding="utf-8", errors="ignore").lower()
            except OSError:
                continue
            for key, label in PY_TECH.items():
                if re.search(rf"(^|[\s\"'\[,]){re.escape(key)}([\s=<>~!\[\],\"';]|$)", text, re.MULTILINE):
                    found[label] += 1
        elif name == "cmakelists.txt":
            found["CMake / C++"] += 1
    if any(p.suffix.lower() == ".ipynb" for p in files):
        found["Jupyter"] += 1
    return [label for label, _ in found.most_common()]


def _image_priority(rel: str, size: int) -> tuple[int, int]:
    low = rel.lower()
    score = 0
    for key, weight in (("screenshot", 6), ("readme", 4), ("docs", 3), ("demo", 3), ("preview", 3), ("assets", 1),
                        ("images", 1), ("figures", 2), ("results", 2)):
        if key in low:
            score += weight
    for key in ("icon", "favicon", "logo", "badge", "apple-touch", "android-chrome", "mstile"):
        if key in low:
            score -= 8
    return (-score, -size)


def _assets(root: Path, files: list[Path]) -> dict[str, list[dict[str, Any]]]:
    out: dict[str, list[dict[str, Any]]] = {"images": [], "models3d": [], "datasets": [], "notebooks": [], "ml_models": []}
    for path in files:
        ext = path.suffix.lower()
        if SECRET_NAME.match(path.name):
            continue
        try:
            size = path.stat().st_size
        except OSError:
            continue
        entry: dict[str, Any] = {"path": _rel(root, path), "name": path.name, "size": size}
        if ext in IMAGE_EXTS and size >= 4 * 1024:
            out["images"].append(entry)
        elif ext in MODEL3D_EXTS and size <= MAX_SERVE_BYTES:
            out["models3d"].append(entry | {"format": ext.lstrip(".")})
        elif ext in DATASET_EXTS and size <= 50 * 1024 * 1024:
            out["datasets"].append(entry)
        elif ext == ".ipynb":
            out["notebooks"].append(entry)
        elif ext in ML_MODEL_EXTS:
            out["ml_models"].append(entry | {"format": ext.lstrip(".")})
    out["images"].sort(key=lambda e: _image_priority(e["path"], e["size"]))
    out["images"] = out["images"][:60]
    out["models3d"].sort(key=lambda e: (e["format"] not in ("glb", "gltf"), -e["size"]))
    return out


def _flatten_metrics(data: Any, prefix: str = "") -> Iterator[tuple[str, float]]:
    if isinstance(data, dict):
        for key, value in data.items():
            yield from _flatten_metrics(value, f"{prefix}.{key}" if prefix else str(key))
    elif isinstance(data, list) and len(data) <= 20:
        for index, value in enumerate(data):
            yield from _flatten_metrics(value, f"{prefix}[{index}]")
    elif isinstance(data, bool):
        return
    elif isinstance(data, int | float):
        yield prefix, float(data)


def _metrics(root: Path, files: list[Path]) -> list[dict[str, Any]]:
    metrics: list[dict[str, Any]] = []
    seen: set[tuple[str, str]] = set()
    for path in files:
        if path.suffix.lower() != ".json" or not METRIC_FILE.search(path.stem):
            continue
        try:
            if path.stat().st_size > 2 * 1024 * 1024:
                continue
            data = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            continue
        source = _rel(root, path)
        for key, value in _flatten_metrics(data):
            leaf = re.split(r"[.\[]", key)[-1]
            if METRIC_KEY.search(leaf) and -1e6 < value < 1e6 and (key, source) not in seen:
                seen.add((key, source))
                metrics.append({"name": key, "value": round(value, 6), "source": source})
    return metrics[:40]


def _run_commands(readme: str) -> list[str]:
    commands: list[str] = []
    for block in re.findall(r"```(?:bash|sh|shell|powershell|ps1|console|cmd)?\n(.*?)```", readme, re.DOTALL):
        for line in block.splitlines():
            stripped = line.strip().lstrip("$> ").strip()
            if re.match(r"^(npm|pnpm|yarn|npx|uvicorn|python3?|pip3?|streamlit|docker|docker-compose|make|cd|bun|expo)\b",
                        stripped):
                commands.append(stripped)
    return list(dict.fromkeys(commands))[:12]


def _readme_hero(readme: str, root: Path, readme_path: Path | None, images: list[dict[str, Any]]) -> str | None:
    known = {img["path"] for img in images}
    base = readme_path.parent if readme_path else root
    for ref in re.findall(r"!\[[^\]]*\]\(([^)\s]+)", readme) + re.findall(r"<img[^>]+src=[\"']([^\"']+)", readme):
        if ref.startswith(("http://", "https://", "data:")):
            continue
        candidate = (base / ref.split("#")[0].split("?")[0]).resolve()
        try:
            rel = candidate.relative_to(root.resolve()).as_posix()
        except ValueError:
            continue
        if rel in known:
            return str(rel)
    return str(images[0]["path"]) if images else None


def _category(slug: str, title: str, readme: str) -> str:
    if slug in CURATED_CATEGORY:
        return CURATED_CATEGORY[slug]
    text = f"{title} {readme[:4000]}".lower()
    scores = {cat: sum(text.count(word) for word in words) for cat, words in CATEGORY_KEYWORDS.items()}
    return max(scores, key=lambda cat: scores[cat]) if any(scores.values()) else "Clinical AI & Workflow"


def _scan_module(root: Path) -> ModuleRecord:
    slug = root.name
    files = list(_walk(root))
    readme_path = _readme_file(root)
    readme = readme_path.read_text(encoding="utf-8", errors="replace") if readme_path else ""
    title, tagline = _title_and_tagline(readme, slug)
    assets = _assets(root, files)
    languages = Counter(p.suffix.lower().lstrip(".") for p in files if p.suffix.lower() in
                        {".py", ".ts", ".tsx", ".js", ".jsx", ".ipynb", ".cpp", ".h", ".kt", ".swift", ".java", ".r"})
    return ModuleRecord(
        slug=slug,
        root=root,
        title=title,
        tagline=tagline or _package_description(root)
        or "The original project has no written description; its code, assets and data are listed here.",
        category=_category(slug, title, readme),
        readme_path=_rel(root, readme_path) if readme_path else None,
        readme=readme,
        features=_features(readme),
        tech=_tech(files)[:10],
        images=assets["images"],
        models3d=assets["models3d"],
        datasets=assets["datasets"],
        notebooks=assets["notebooks"],
        ml_models=assets["ml_models"],
        metrics=_metrics(root, files),
        run_commands=_run_commands(readme),
        languages=dict(languages.most_common()),
        files_total=len(files),
        hero_image=_readme_hero(readme, root, readme_path, assets["images"]),
        live_app=(live_app_dir(slug) / "index.html").is_file(),
    )


@lru_cache(maxsize=1)
def _catalog() -> dict[str, ModuleRecord]:
    root = modules_root()
    if not root.is_dir():
        return {}
    return {child.name: _scan_module(child) for child in sorted(root.iterdir())
            if child.is_dir() and not child.name.startswith(".")}


def refresh_catalog() -> None:
    _catalog.cache_clear()


def list_modules() -> list[ModuleRecord]:
    return list(_catalog().values())


def get_module(slug: str) -> ModuleRecord | None:
    return _catalog().get(slug)


def overview() -> dict[str, Any]:
    records = list_modules()
    tech: Counter[str] = Counter(label for r in records for label in r.tech)
    return {
        "modules": len(records),
        "files": sum(r.files_total for r in records),
        "images": sum(len(r.images) for r in records),
        "models3d": sum(len(r.models3d) for r in records),
        "datasets": sum(len(r.datasets) for r in records),
        "notebooks": sum(len(r.notebooks) for r in records),
        "ml_models": sum(len(r.ml_models) for r in records),
        "metrics": sum(len(r.metrics) for r in records),
        "live_apps": sum(1 for r in records if r.live_app),
        "categories": {cat: sum(1 for r in records if r.category == cat) for cat in CATEGORIES},
        "tech": dict(tech.most_common(16)),
    }


def resolve_module_file(slug: str, rel_path: str) -> Path | None:
    """A file inside the module that may be served, or None (outside, missing, secret or unsupported)."""
    record = get_module(slug)
    if record is None or not rel_path or "\x00" in rel_path:
        return None
    root = record.root.resolve()
    candidate = (root / rel_path).resolve()
    try:
        inner = candidate.relative_to(root)
    except ValueError:
        return None
    if any(part in SKIP_DIRS for part in inner.parts):
        return None
    if not candidate.is_file() or SECRET_NAME.match(candidate.name):
        return None
    if candidate.suffix.lower() not in SERVABLE_EXTS or candidate.stat().st_size > MAX_SERVE_BYTES:
        return None
    return candidate


def preview_dataset(path: Path, rows: int = 25) -> dict[str, Any]:
    """Header and the first rows of a CSV/TSV file."""
    delimiter = "\t" if path.suffix.lower() == ".tsv" else ","
    with path.open(encoding="utf-8", errors="replace", newline="") as handle:
        reader = csv.reader(handle, delimiter=delimiter)
        header = next(reader, [])
        body = []
        for index, row in enumerate(reader):
            if index >= rows:
                break
            body.append(row)
    with path.open(encoding="utf-8", errors="replace") as handle:
        total = max(sum(1 for _ in handle) - 1, 0)
    return {"columns": header, "rows": body, "total_rows": total}


def resolve_live_app_file(slug: str, rel_path: str) -> Path | None:
    """A file of a module's built web app; unknown client-side routes fall back to its index.html.

    A missing file (a path with an extension) is not a route: it stays missing, so an app sees a
    404 instead of HTML where it expected JSON or a model.
    """
    if slug not in _catalog():
        return None
    root = live_app_dir(slug).resolve()
    index = root / "index.html"
    if not index.is_file():
        return None
    candidate = (root / (rel_path or "index.html")).resolve()
    try:
        candidate.relative_to(root)
    except ValueError:
        return None
    if candidate.is_file():
        return candidate
    return None if Path(rel_path).suffix else index
