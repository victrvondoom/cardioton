"""Optional existing-gateway selection of verbatim grounded passages.

The model cannot author clinical claims. It returns only indices of deterministic
retrieved passages. Raw questions, notes, media, identifiers and locations are not
sent to a provider. An unavailable gateway leaves the grounded answer intact.
"""

from __future__ import annotations

import asyncio
import json
import re
from typing import Any

from pydantic import Field, StrictInt

from app.cardiotwin.hemodynamics.schema import StrictModel

from .schema import ExplainRequest


class PassageSelection(StrictModel):
    indices: list[StrictInt] = Field(min_length=1, max_length=8)


async def assist(
    request: ExplainRequest, answer: dict[str, Any], user: dict[str, Any]
) -> dict[str, Any]:
    if not request.use_ai:
        return answer
    from app.core__backend_app__config import settings
    from app.db import db

    if not settings.GENAI_GATEWAY_ENABLED or db._pool is None:
        return {
            **answer,
            "ai_status": "PROVIDER UNAVAILABLE: governed quota and audit storage required; deterministic answer retained",
        }

    from app.llm import get_llm_client
    from app.llm.gateway import GatewayCallContext, reset_call_context, set_call_context

    passages = [p.strip() for p in re.split(r"(?<=[.!?])\s+", answer["answer"]) if p.strip()]
    if len(passages) > 8:
        return {
            **answer,
            "ai_status": "Deterministic answer retained: passage context exceeds optional ordering bound",
        }
    context = set_call_context(
        GatewayCallContext(
            organization_id=str(user["organization_id"]),
            case_id=None,
            agent_name="atlas-grounded-copilot",
            request_id=None,
        )
    )
    try:
        response = await asyncio.wait_for(
            get_llm_client().complete(
                system='Select relevant passages from supplied deterministic research evidence. Return only JSON {"indices":[0,...]}. Never author a new statement, approve a state, diagnose or prescribe. Indices must refer to the supplied passages. Keep uncertainty and safety passages.',
                user=json.dumps(
                    {
                        "task": "Organize the retrieved answer while preserving its uncertainty",
                        "passages": passages,
                        "schema": PassageSelection.model_json_schema(),
                    }
                ),
                max_tokens=200,
                temperature=0,
            ),
            timeout=20,
        )
        selection = PassageSelection.model_validate_json(response.text).indices
        if len(set(selection)) != len(selection) or any(
            i < 0 or i >= len(passages) for i in selection
        ):
            raise ValueError("Model selected an unsupported passage")
        # Require every passage: only ordering may change; safety cannot be omitted.
        if set(selection) != set(range(len(passages))):
            raise ValueError("Model omitted retrieved uncertainty or safety content")
        return {
            **answer,
            "answer": " ".join(passages[i] for i in selection),
            "mode": "GOVERNED_AI_PASSAGE_ORDERING",
            "provider": response.model_id,
            "ai_status": "AI organized verbatim retrieved passages; no generated clinical facts",
        }
    except Exception:
        return {
            **answer,
            "ai_status": "PROVIDER UNAVAILABLE OR OUTPUT REJECTED: deterministic retrieved answer retained",
        }
    finally:
        reset_call_context(context)
