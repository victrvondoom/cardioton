"""Gateway assistance cannot invent facts or bypass audit/quota boundaries."""

import json
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from app.cardiotwin.atlas.copilot import assist
from app.cardiotwin.atlas.schema import AtlasInput, ExplainRequest, ScenarioRequest
from app.cardiotwin.atlas.service import reconstruct_atlas, sandbox
from app.config import settings
from app.db import db
from app.llm.gateway import get_call_context

USER = {"organization_id": "tenant-test", "id": "reviewer-test"}
ANSWER = {
    "answer": "Volume is uncertain. Human review is required.",
    "evidence_refs": ["a"],
    "mode": "DETERMINISTIC_RETRIEVAL",
}
REQUEST = ExplainRequest(
    input=AtlasInput(as_of="2026-08-10T23:59:59Z", demo=True),
    question="PRIVATE QUESTION IS NOT TRANSMITTED",
    use_ai=True,
)


@pytest.mark.asyncio
async def test_unavailable_gateway_keeps_grounded_answer(monkeypatch):
    monkeypatch.setattr(db, "_pool", None)
    result = await assist(REQUEST, ANSWER, USER)
    assert result["answer"] == ANSWER["answer"]
    assert "PROVIDER UNAVAILABLE" in result["ai_status"]
    assert get_call_context() is None


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "output",
    [
        '{"indices":[1,0]}',
        '{"indices":[2]}',
        '{"indices":[0]}',
        '{"indices":[0,0]}',
        '{"indices":[0,1],"diagnosis":"invented"}',
        "The patient has invented disease",
        '{"indices":[0.0,1]}',
    ],
)
async def test_ai_selects_only_complete_verbatim_grounded_passages(monkeypatch, output):
    monkeypatch.setattr(settings, "GENAI_GATEWAY_ENABLED", True)
    monkeypatch.setattr(db, "_pool", object())

    async def complete(**kwargs):
        assert get_call_context().organization_id == "tenant-test"
        assert "PRIVATE QUESTION" not in kwargs["user"]
        assert set(json.loads(kwargs["user"])) == {"task", "passages", "schema"}
        return SimpleNamespace(text=output, model_id="mock-governed-provider")

    mock = AsyncMock(side_effect=complete)
    monkeypatch.setattr("app.llm.get_llm_client", lambda: SimpleNamespace(complete=mock))
    result = await assist(REQUEST, ANSWER, USER)
    if output == '{"indices":[1,0]}':
        assert result["answer"] == "Human review is required. Volume is uncertain."
        assert result["mode"] == "GOVERNED_AI_PASSAGE_ORDERING"
    else:
        assert result["answer"] == ANSWER["answer"]
        assert "OUTPUT REJECTED" in result["ai_status"]
    assert result["evidence_refs"] == ["a"]
    assert get_call_context() is None


@pytest.mark.asyncio
async def test_provider_failure_retains_answer_and_resets_scope(monkeypatch):
    monkeypatch.setattr(settings, "GENAI_GATEWAY_ENABLED", True)
    monkeypatch.setattr(db, "_pool", object())
    monkeypatch.setattr(
        "app.llm.get_llm_client",
        lambda: SimpleNamespace(
            complete=AsyncMock(side_effect=RuntimeError("PRIVATE PROVIDER ERROR"))
        ),
    )
    result = await assist(REQUEST, ANSWER, USER)
    assert result["answer"] == ANSWER["answer"]
    assert "PRIVATE PROVIDER ERROR" not in str(result)
    assert get_call_context() is None


def test_explicit_hypothetical_sources_cannot_be_reimported_into_original_twin():
    scenario = sandbox(
        ScenarioRequest(input=REQUEST.input, changes=[{"kind": "spo2", "value": 88.0, "unit": "%"}])
    )
    with pytest.raises(ValueError, match="Hypothetical"):
        reconstruct_atlas(
            AtlasInput.model_validate(
                {
                    "as_of": scenario["simulated"]["as_of"],
                    "patient_ref": scenario["simulated"]["twin"]["patient_ref"],
                    "evidence": scenario["simulated"]["twin"]["evidence"],
                }
            )
        )


def test_future_or_other_patient_hypothetical_records_do_not_change_earlier_replay():
    base = reconstruct_atlas(REQUEST.input)
    at = REQUEST.input.as_of
    patient = base["twin"]["patient_ref"]
    record = base["twin"]["evidence"][0]
    for update in [
        {"event_at": "2026-09-01T00:00:00Z", "available_at": "2026-09-01T00:00:00Z"},
        {"patient_ref": "Patient/another-synthetic-patient"},
    ]:
        hypothetical = {**record, "id": "isolated-later", "patient_ref": patient, **update,
                        "provenance": {"hypothetical": True}}
        original = AtlasInput(as_of=at, patient_ref=patient, evidence=base["twin"]["evidence"])
        extended = original.model_copy(update={"evidence": [*original.evidence, type(original.evidence[0]).model_validate(hypothetical)]})
        assert reconstruct_atlas(extended) == reconstruct_atlas(original)
