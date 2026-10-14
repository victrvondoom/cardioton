"""Small, deterministic artifact and acquisition helpers."""

import hashlib
import json
import os
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

ROOT = Path(__file__).resolve().parents[1]


def canonical_json(value: Any) -> bytes:
    return (json.dumps(value, sort_keys=True, indent=2, allow_nan=False) + "\n").encode()


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def object_digest(value: Any) -> str:
    return digest(canonical_json(value))


def read_json(path: Path) -> Any:
    return json.loads(path.read_text())


def write_once(path: Path, content: bytes) -> None:
    """Never overwrite an existing artifact, even with another valid split."""
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists():
        if path.read_bytes() != content:
            raise ValueError(f"Immutable artifact differs: {path}. Use a new versioned directory.")
        return
    # Exclusive creation prevents concurrent writers from replacing a locked artifact.
    try:
        with path.open("xb") as stream:
            stream.write(content)
            stream.flush()
            os.fsync(stream.fileno())
    except FileExistsError:
        if path.read_bytes() != content:
            raise ValueError(f"Concurrent artifact conflict: {path}") from None


def write_json_once(path: Path, value: Any) -> None:
    write_once(path, canonical_json(value))


def utc_now() -> str:
    return datetime.now(UTC).isoformat()


def session() -> requests.Session:
    client = requests.Session()
    client.headers["User-Agent"] = "CardioScope/0.1 (public research dataset acquisition)"
    retry = Retry(total=3, backoff_factor=0.5, status_forcelist=[429, 500, 502, 503, 504])
    client.mount("https://", HTTPAdapter(max_retries=retry))
    return client


def download(url: str, path: Path, expected_sha256: str | None = None) -> dict:
    """Download to a temporary file; publish only a complete verified artifact."""
    if path.exists():
        sha = digest(path.read_bytes())
        if expected_sha256 and sha != expected_sha256:
            raise ValueError(f"Checksum mismatch in cached source: {path}")
        return {"url": url, "sha256": sha, "bytes": path.stat().st_size}
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_suffix(path.suffix + ".partial")
    try:
        with session() as client, client.get(url, stream=True, timeout=(15, 60)) as response:
            response.raise_for_status()
            with temp.open("wb") as stream:
                for chunk in response.iter_content(1024 * 128):
                    stream.write(chunk)
        content = temp.read_bytes()
        sha = digest(content)
        if expected_sha256 and sha != expected_sha256:
            raise ValueError(
                f"Upstream source changed: {url}; expected {expected_sha256}, got {sha}"
            )
        write_once(path, content)
    finally:
        temp.unlink(missing_ok=True)
    return {"url": url, "sha256": sha, "bytes": len(content)}
