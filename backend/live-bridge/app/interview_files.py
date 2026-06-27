"""Secure CV/resume file validation for Interview Mode (#21, #45).

The candidate may upload a resume as PDF, DOCX, or TXT. This is the hardened edge:
we validate by CONTENT, never by extension or client MIME, reject anything that is
not exactly one of the three safe types, and reject dangerous active content. We
do NOT run our own PDF/DOCX parser in our trust boundary; the validated bytes are
handed to Gemini on Vertex for extraction (a memory-unsafe native parser is the
single biggest server-side risk, so we avoid it).

Hardening deferred to a documented follow-up (see docs/blockers.md): ClamAV
malware scan + unscanned/clean/quarantine buckets + qpdf/LibreOffice CDR + short
retention. This module is the edge validation + active-content rejection baseline.
"""

from __future__ import annotations

import os
import re

from fastapi import HTTPException

# Real resumes are tiny; cap aggressively so legitimate users never hit it.
MAX_PDF_DOCX_BYTES = int(os.getenv("OHMLET_MAX_CV_BYTES", str(10 * 1024 * 1024)))  # 10 MB
MAX_TXT_BYTES = int(os.getenv("OHMLET_MAX_CV_TXT_BYTES", str(1 * 1024 * 1024)))    # 1 MB

# Magic-byte signatures we explicitly REJECT (defense in depth; generic error).
_BAD_SIGNATURES = (
    b"MZ",                       # PE / EXE / DLL
    b"\x7fELF",                  # ELF
    b"\xfe\xed\xfa\xce",         # Mach-O 32
    b"\xfe\xed\xfa\xcf",         # Mach-O 64
    b"\xce\xfa\xed\xfe",         # Mach-O reversed
    b"\xcf\xfa\xed\xfe",
    b"\xca\xfe\xba\xbe",         # Mach-O fat / Java class
    b"#!",                       # script shebang
    b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1",  # legacy OLE (.doc/.xls macro container)
    b"<!DOCTYPE",                # HTML (also catches PDF/HTML polyglot)
    b"<html",
    b"<?php",
    b"<script",
)

# Dangerous PDF active-content tokens. If present we reject rather than try to
# sanitize (CDR is the deferred hardening; reject is the safe default for v1).
_PDF_DANGER = (b"/JavaScript", b"/JS", b"/Launch", b"/OpenAction", b"/AA", b"/EmbeddedFile", b"/RichMedia")

# DOCX is a zip; reject any that carries VBA macros or OLE objects.
_DOCX_DANGER = (b"vbaProject.bin", b"oleObject")

Kind = str  # "pdf" | "docx" | "txt"


def _reject(msg: str = "Unsupported or unsafe file.") -> None:
    raise HTTPException(status_code=422, detail=msg)


def validate_resume(filename: str, data: bytes) -> Kind:
    """Validate an uploaded resume by content. Returns the safe kind, or raises 4xx.

    Order: size -> reject-bad-signatures -> identify by magic bytes -> per-type
    structural/active-content checks.
    """
    if not data:
        _reject("The file is empty.")
    head = data[:2048]
    lowhead = head.lower()

    # Explicit bad signatures first (cheap, decisive).
    for sig in _BAD_SIGNATURES:
        if head.startswith(sig) or lowhead.startswith(sig.lower()):
            _reject()

    ext = ("." + filename.rsplit(".", 1)[-1].lower()) if "." in filename else ""

    # PDF: %PDF- must be at offset 0 (deliberately stricter than the spec's
    # "first 1024 bytes" — this is the primary anti-polyglot control).
    if data[:5] == b"%PDF-":
        if len(data) > MAX_PDF_DOCX_BYTES:
            raise HTTPException(status_code=413, detail="The file is too large.")
        if b"/Encrypt" in data:
            _reject("Password-protected PDFs are not supported. Please upload an unprotected file.")
        for tok in _PDF_DANGER:
            if tok in data:
                _reject("This PDF contains active content (scripts or embedded files) and was rejected.")
        return "pdf"

    # DOCX: ZIP magic + OOXML wordprocessing markers; reject macros/OLE.
    if data[:4] == b"PK\x03\x04":
        if len(data) > MAX_PDF_DOCX_BYTES:
            raise HTTPException(status_code=413, detail="The file is too large.")
        if b"word/" not in data or b"[Content_Types].xml" not in data:
            _reject("Only Word .docx resumes are supported (not other Office or zip files).")
        for tok in _DOCX_DANGER:
            if tok in data:
                _reject("This document contains macros or embedded objects and was rejected.")
        return "docx"

    # TXT: must decode cleanly as UTF-8, no NUL, mostly printable, and be declared .txt.
    if ext == ".txt":
        if len(data) > MAX_TXT_BYTES:
            raise HTTPException(status_code=413, detail="The file is too large.")
        if b"\x00" in data:
            _reject()
        try:
            text = data.decode("utf-8")
        except UnicodeDecodeError:
            _reject("Text files must be UTF-8.")
        printable = sum(1 for ch in text if ch in "\r\n\t" or ch.isprintable())
        if text and printable / len(text) < 0.9:
            _reject()
        return "txt"

    _reject("Please upload a PDF, DOCX, or TXT resume.")
    return "txt"  # unreachable; keeps type checkers happy


# MIME types to hand the validated bytes to Gemini.
MIME_FOR = {
    "pdf": "application/pdf",
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "txt": "text/plain",
}
