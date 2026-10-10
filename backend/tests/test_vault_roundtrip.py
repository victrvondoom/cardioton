import pytest

from app.privacy import tokenization


@pytest.mark.parametrize("value", ["", "synthetic-MRN-123", "José / नमूना / 心臓", "x" * 257])
def test_dev_vault_decrypt_restores_exact_utf8_text(monkeypatch, value):
    monkeypatch.setattr(tokenization, "_vault_key", lambda: bytes(range(32)))
    encrypted = tokenization._encrypt(value)
    assert isinstance(encrypted, bytes)
    assert tokenization._decrypt(encrypted) == value
    if value:
        assert encrypted != value.encode("utf-8")
