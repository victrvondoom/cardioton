"""Bounded local parsing. No OCR provider, URL fetch, DICOM or active PDF content."""

from __future__ import annotations

import hashlib
import io
import json
import re
from pathlib import PurePosixPath
from typing import Any

from fastapi import HTTPException
from pypdf import PdfReader, apply_configuration
from pypdf.generic import DictionaryObject, IndirectObject, StreamObject

MAX_BYTES = 8 * 1024 * 1024
MAX_JSON_BYTES = 2 * 1024 * 1024
MAX_PAGES = 30
MAX_STREAM_BYTES = 2 * 1024 * 1024
MAX_DECODED_BYTES = 16 * 1024 * 1024
MAX_TEXT_CHARS = 300_000
MAX_OBJECTS = 4000


def _pdf(data: bytes) -> tuple[str, int, dict[str, Any]]:
    if not data.startswith(b"%PDF-") or b"%%EOF" not in data[-2048:]:
        raise HTTPException(422, "Invalid PDF signature or end marker")
    # Limits are context-local, restored after parsing, and apply during decoding,
    # rather than checking expanded data only after an unbounded decompression.
    with apply_configuration(
        maximum_declared_stream_length=MAX_STREAM_BYTES,
        array_based_stream_maximum_output_length=MAX_STREAM_BYTES,
        zlib_maximum_output_length=MAX_STREAM_BYTES,
        lzw_maximum_output_length=MAX_STREAM_BYTES,
        run_length_maximum_output_length=MAX_STREAM_BYTES,
        image_maximum_buffer_size=MAX_STREAM_BYTES,
        xmp_maximum_input_length=MAX_STREAM_BYTES,
        page_tree_maximum_entries=MAX_PAGES * 4,
        page_tree_maximum_depth=12,
        xform_maximum_invocations_per_extraction=200,
        disable_legacy_handling=True,
    ):
        try:
            reader = PdfReader(io.BytesIO(data), strict=True, root_object_recovery_limit=1000)
            if reader.is_encrypted:
                raise HTTPException(422, "Encrypted PDFs are not supported")
            if len(reader.pages) > MAX_PAGES:
                raise HTTPException(413, f"PDF exceeds {MAX_PAGES} pages")
            seen: set[tuple[int, int] | int] = set()
            expanded = 0

            def inspect(obj: Any, depth: int = 0) -> None:
                nonlocal expanded
                if depth > 24:
                    raise HTTPException(413, "PDF object nesting exceeds parser limit")
                key: tuple[int, int] | int = (obj.idnum, obj.generation) if isinstance(obj, IndirectObject) else id(obj)
                if key in seen:
                    return
                seen.add(key)
                if len(seen) > MAX_OBJECTS:
                    raise HTTPException(413, "PDF exceeds object limit")
                if isinstance(obj, IndirectObject):
                    inspect(obj.get_object(), depth + 1)
                elif isinstance(obj, DictionaryObject):
                    if any(k in obj for k in ("/JS", "/JavaScript", "/EmbeddedFiles", "/OpenAction", "/AA")):
                        raise HTTPException(422, "Active content and embedded files are not accepted")
                    if obj.get("/S") in ("/Launch", "/JavaScript", "/SubmitForm", "/ImportData"):
                        raise HTTPException(422, "Active PDF actions are not accepted")
                    if isinstance(obj, StreamObject):
                        filters = obj.get("/Filter", [])
                        filters = filters if isinstance(filters, list) else [filters]
                        allowed = {"/FlateDecode", "/ASCIIHexDecode", "/ASCII85Decode", "/LZWDecode", "/RunLengthDecode", "/DCTDecode", "/JPXDecode", "/CCITTFaxDecode"}
                        if any(str(f) not in allowed for f in filters):
                            raise HTTPException(422, "Unsupported PDF stream filter")
                        decoded = obj.get_data()
                        expanded += len(decoded)
                        if len(decoded) > MAX_STREAM_BYTES or expanded > MAX_DECODED_BYTES:
                            raise HTTPException(413, "PDF decoded-stream limit exceeded")
                    for value in obj.values():
                        inspect(value, depth + 1)
                elif isinstance(obj, list):
                    for value in obj:
                        inspect(value, depth + 1)

            inspect(reader.trailer)
            chunks: list[str] = []
            count = 0
            for page in reader.pages:
                text = page.extract_text() or ""
                count += len(text)
                if count > MAX_TEXT_CHARS:
                    raise HTTPException(413, "PDF extracted-text limit exceeded")
                chunks.append(text)
            metadata = reader.metadata
            author = str(metadata.author)[:180] if metadata and metadata.author else None
            return "\n".join(chunks), len(reader.pages), {"author": author}
        except HTTPException:
            raise
        except Exception as exc:
            # Never leak PDF payload or parser diagnostic strings into responses.
            raise HTTPException(422, "PDF is malformed, exceeds safe parser bounds, or has no supported text layer") from exc


def _json_bounds(value: Any, depth: int = 0, budget: list[int] | None = None) -> None:
    remaining = budget if budget is not None else [15_000]
    remaining[0] -= 1
    if depth > 18 or remaining[0] < 0:
        raise HTTPException(413, "FHIR document nesting or object limit exceeded")
    if isinstance(value, dict):
        for key, item in value.items():
            if not isinstance(key, str):
                raise HTTPException(422, "FHIR object keys must be strings")
            _json_bounds(item, depth + 1, remaining)
    elif isinstance(value, list):
        for item in value:
            _json_bounds(item, depth + 1, remaining)
    elif isinstance(value, str) and len(value) > MAX_TEXT_CHARS:
        raise HTTPException(413, "FHIR text limit exceeded")


def parse_upload(data: bytes, filename: str, media_type: str, synthetic: bool) -> dict[str, Any]:
    if not data:
        raise HTTPException(422, "Report is empty")
    if len(data) > MAX_BYTES:
        raise HTTPException(413, "Report exceeds 8 MB limit")
    filename = PurePosixPath(filename.replace("\\", "/")).name
    filename = re.sub(r"[\x00-\x1f\x7f]", "", filename)[:180] or "report"
    suffix = filename.lower().rsplit(".", 1)[-1]
    media_type = media_type.split(";", 1)[0].lower()
    original: dict[str, Any] | None = None
    metadata: dict[str, Any] = {}
    pages = None
    if suffix == "pdf" and media_type in ("application/pdf", "application/octet-stream", ""):
        text, pages, metadata = _pdf(data)
        media_type = "application/pdf"
    elif suffix == "txt" and media_type in ("text/plain", "application/octet-stream", ""):
        if not synthetic:
            raise HTTPException(422, "Plain text reports are supported for explicitly synthetic examples only")
        try:
            text = data.decode("utf-8-sig")
        except UnicodeError as exc:
            raise HTTPException(422, "Text report must be UTF-8") from exc
        if "\x00" in text or len(text) > MAX_TEXT_CHARS:
            raise HTTPException(413, "Text report exceeds safe text bounds")
        media_type = "text/plain"
    elif suffix == "json" and media_type in ("application/json", "application/fhir+json", "application/octet-stream", ""):
        if len(data) > MAX_JSON_BYTES:
            raise HTTPException(413, "FHIR JSON exceeds 2 MB limit")
        try:
            original = json.loads(data.decode("utf-8-sig"), parse_constant=lambda _: (_ for _ in ()).throw(ValueError()))
        except (ValueError, UnicodeError, RecursionError) as exc:
            raise HTTPException(422, "Invalid FHIR JSON") from exc
        if not isinstance(original, dict) or original.get("resourceType") not in ("Bundle", "DiagnosticReport", "Observation"):
            raise HTTPException(422, "Expected a FHIR Bundle, DiagnosticReport or Observation")
        _json_bounds(original)
        text = ""
        media_type = "application/fhir+json"
    else:
        raise HTTPException(415, "Supported report types: text-layer PDF, FHIR JSON, or explicitly synthetic TXT; DICOM requires a separate validated imaging pathway")
    if original is None and not text.strip():
        raise HTTPException(422, "No readable text layer; scanned reports require a separately configured OCR pathway")
    return {
        "text": text, "fhir": original,
        "source": {
            "filename": filename, "media_type": media_type,
            "sha256": hashlib.sha256(data).hexdigest(), "size_bytes": len(data),
            "page_count": pages, "original_file_retained": False,
            "extraction_method": "FHIR exact code and explicit report text" if original else "local deterministic text extraction",
            **metadata,
        },
    }
