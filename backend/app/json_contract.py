"""Validate object boundaries from JSON parsers and external SDKs."""

from typing import Any


def json_object(value: object, context: str) -> dict[str, Any]:
    """Nested FHIR/SDK values stay dynamic; the outer object must be real."""
    if not isinstance(value, dict) or any(not isinstance(key, str) for key in value):
        raise ValueError(f"{context} must be a JSON object")
    return value


def json_objects(value: object, context: str) -> list[dict[str, Any]]:
    if not isinstance(value, list):
        raise ValueError(f"{context} must be a JSON array")
    return [json_object(item, context) for item in value]
