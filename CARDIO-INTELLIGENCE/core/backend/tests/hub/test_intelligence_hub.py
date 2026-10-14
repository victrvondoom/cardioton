"""Intelligence Hub API: catalogue, file serving guards, dataset previews and embedded live apps.

Every test runs against a synthetic modules tree, so the real inherited projects are never touched.
"""

from __future__ import annotations

import json
from collections.abc import AsyncIterator, Iterator
from pathlib import Path

import pytest
from httpx import ASGITransport, AsyncClient

from app.auth import get_current_user
from app.hub import module_catalog
from app.main import app

API = "/api/v1/hub"
README = """# Heart Lens

[![badge](https://img.shields.io/badge/x-y-blue)](https://example.org)

Heart Lens predicts coronary artery disease risk from routine clinical data
and paints it onto an interactive 3D heart for every major vessel.

## Features
- Per-vessel probabilities for LAD, LCX and RCA
- SHAP explanations for every prediction

```bash
npm run dev
```
"""


@pytest.fixture
def modules_root(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Iterator[Path]:
    module = tmp_path / "heart-lens"
    (module / "docs").mkdir(parents=True)
    (module / "README.md").write_text(README, encoding="utf-8")
    (module / "docs" / "screenshot.png").write_bytes(b"\x89PNG\r\n\x1a\n" + b"\0" * 5000)
    (module / "data.csv").write_text("age,cad\n" + "".join(f"{50 + i},{i % 2}\n" for i in range(30)), encoding="utf-8")
    (module / "metrics.json").write_text(json.dumps({"cad": {"roc_auc": 0.91, "accuracy": 0.84}}), encoding="utf-8")
    (module / "heart.obj").write_text("v 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3\n", encoding="utf-8")
    (module / ".env").write_text("SECRET=synthetic-test-value\n", encoding="utf-8")
    (module / "server.py").write_text("print('source code is not served')\n", encoding="utf-8")
    build = module / ".hub-build"
    (build / "assets").mkdir(parents=True)
    (build / "index.html").write_text("<!doctype html><title>Heart Lens app</title>", encoding="utf-8")
    (build / "assets" / "app.js").write_text("console.log('app')", encoding="utf-8")
    (tmp_path / "bare-project").mkdir()
    (tmp_path / "bare-project" / "main.py").write_text("x = 1\n", encoding="utf-8")

    monkeypatch.setenv("CARDIO_MODULES_ROOT", str(tmp_path))
    module_catalog.refresh_catalog()
    yield tmp_path
    module_catalog.refresh_catalog()


@pytest.fixture
async def client(modules_root: Path) -> AsyncIterator[AsyncClient]:
    app.dependency_overrides[get_current_user] = lambda: {
        "id": "u1",
        "organization_id": "org_hub_test",
        "role": "coordinator",
        "email": "hub@test",
    }
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://testserver") as c:
            yield c
    finally:
        app.dependency_overrides.pop(get_current_user, None)


@pytest.mark.asyncio
async def test_catalogue_requires_sign_in(modules_root: Path) -> None:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://testserver") as anonymous:
        for path in ("/overview", "/modules", "/modules/heart-lens", "/modules/heart-lens/files/docs/screenshot.png"):
            response = await anonymous.get(f"{API}{path}")
            assert response.status_code in (401, 403), path


@pytest.mark.asyncio
async def test_overview_counts_what_the_modules_contain(client: AsyncClient) -> None:
    body = (await client.get(f"{API}/overview")).json()
    assert body["modules"] == 2
    assert body["images"] == 1
    assert body["models3d"] == 1
    assert body["datasets"] == 1
    assert body["metrics"] == 2
    assert body["live_apps"] == 1


@pytest.mark.asyncio
async def test_module_summary_reads_title_tagline_and_features(client: AsyncClient) -> None:
    modules = {m["slug"]: m for m in (await client.get(f"{API}/modules")).json()}
    lens = modules["heart-lens"]
    assert lens["title"] == "Heart Lens"
    # The wrapped paragraph is joined; the badge line is skipped.
    assert lens["tagline"].startswith("Heart Lens predicts coronary artery disease risk")
    assert lens["tagline"].endswith("for every major vessel.")
    assert lens["features"][0] == "Per-vessel probabilities for LAD, LCX and RCA"
    assert lens["hero_image"] == "docs/screenshot.png"
    assert lens["live_app"] is True
    assert modules["bare-project"]["tagline"].startswith("The original project has no written description")


@pytest.mark.asyncio
async def test_module_detail_and_unknown_module(client: AsyncClient) -> None:
    detail = (await client.get(f"{API}/modules/heart-lens")).json()
    assert {m["name"] for m in detail["metrics"]} == {"cad.roc_auc", "cad.accuracy"}
    assert detail["run_commands"] == ["npm run dev"]
    assert [f["path"] for f in detail["models3d"]] == ["heart.obj"]
    # Secrets never appear in any listing.
    listed = json.dumps(detail)
    assert ".env" not in listed and "synthetic-test-value" not in listed
    assert (await client.get(f"{API}/modules/nope")).status_code == 404


@pytest.mark.asyncio
async def test_files_are_served_with_guards(client: AsyncClient) -> None:
    image = await client.get(f"{API}/modules/heart-lens/files/docs/screenshot.png")
    assert image.status_code == 200
    assert image.headers["content-type"].startswith("image/png")
    for blocked in (".env", "server.py", "..%2F..%2Fetc%2Fpasswd", "docs/..%2F..%2Fbare-project%2Fmain.py",
                    ".hub-build/index.html", "missing.png"):
        response = await client.get(f"{API}/modules/heart-lens/files/{blocked}")
        assert response.status_code == 404, blocked


@pytest.mark.asyncio
async def test_dataset_preview_limits_rows(client: AsyncClient) -> None:
    body = (await client.get(f"{API}/modules/heart-lens/datasets/data.csv", params={"rows": 5})).json()
    assert body["columns"] == ["age", "cad"]
    assert body["rows"][0] == ["50", "0"]
    assert len(body["rows"]) == 5
    assert body["total_rows"] == 30
    assert (await client.get(f"{API}/modules/heart-lens/datasets/data.csv", params={"rows": 500})).status_code == 422


@pytest.mark.asyncio
async def test_live_app_is_served_without_sign_in(modules_root: Path) -> None:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://testserver") as anonymous:
        index = await anonymous.get(f"{API}/apps/heart-lens/")
        assert index.status_code == 200 and "Heart Lens app" in index.text
        asset = await anonymous.get(f"{API}/apps/heart-lens/assets/app.js")
        assert asset.status_code == 200 and asset.headers["content-type"].startswith("text/javascript")
        # Client-side routes fall back to the app shell.
        assert "Heart Lens app" in (await anonymous.get(f"{API}/apps/heart-lens/results/42")).text
        # A missing file is a 404, never the app shell served as if it were JSON.
        assert (await anonymous.get(f"{API}/apps/heart-lens/model.json")).status_code == 404
        assert (await anonymous.get(f"{API}/apps/bare-project/")).status_code == 404
        assert (await anonymous.get(f"{API}/apps/heart-lens/..%2F.env")).status_code == 404
