import numpy as np
import pytest

from app.api.oncotwin import clean, clean_object
from app.json_contract import json_object, json_objects


@pytest.mark.parametrize("value", [None, [], "text", 1, {1: "invalid key"}])
def test_object_contract_rejects_non_objects(value):
    with pytest.raises(ValueError, match="must be a JSON object"):
        json_object(value, "response")


def test_object_array_validates_every_member():
    assert json_objects([{"id": "first"}, {"id": "second"}], "rows") == [
        {"id": "first"}, {"id": "second"}
    ]
    with pytest.raises(ValueError, match="must be a JSON object"):
        json_objects([{"id": "first"}, None], "rows")
    with pytest.raises(ValueError, match="must be a JSON array"):
        json_objects({"id": "first"}, "rows")


def test_twin_json_normalization_preserves_nested_arrays_and_nulls():
    payload = {"rows": np.array([[1.0, np.nan]]), "valid": np.bool_(True)}
    assert clean_object(payload) == {"rows": [[1.0, None]], "valid": True}
    assert clean(np.array([1.0, np.nan])) == [1.0, None]
    with pytest.raises(ValueError, match="must be a JSON object"):
        clean_object([{"id": "first"}])
