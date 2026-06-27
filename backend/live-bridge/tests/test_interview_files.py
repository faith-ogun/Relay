"""Secure resume-upload validation (#21, #45). The dangerous-file rejection is the
user-facing security promise, so it is unit-tested directly."""

import zipfile
import io

import pytest
from fastapi import HTTPException

import interview_files as f


def _docx(extra: dict | None = None) -> bytes:
    """Minimal DOCX-shaped zip with the OOXML markers."""
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as z:
        z.writestr("[Content_Types].xml", "<Types/>")
        z.writestr("word/document.xml", "<w:document/>")
        for name, body in (extra or {}).items():
            z.writestr(name, body)
    return buf.getvalue()


def test_accepts_clean_pdf():
    assert f.validate_resume("cv.pdf", b"%PDF-1.7\n... normal resume text ...") == "pdf"


def test_accepts_clean_docx():
    assert f.validate_resume("cv.docx", _docx()) == "docx"


def test_accepts_clean_txt():
    assert f.validate_resume("cv.txt", b"Jane Engineer\nEmbedded C, RTOS, I2C\n") == "txt"


def test_rejects_exe_renamed_pdf():
    with pytest.raises(HTTPException):
        f.validate_resume("resume.pdf", b"MZ\x90\x00 this is actually an exe")


def test_rejects_elf_and_macho_and_script():
    for sig in (b"\x7fELF....", b"\xca\xfe\xba\xbe....", b"#!/bin/sh\nrm -rf /"):
        with pytest.raises(HTTPException):
            f.validate_resume("resume.pdf", sig)


def test_rejects_html_polyglot():
    with pytest.raises(HTTPException):
        f.validate_resume("resume.pdf", b"<html><script>alert(1)</script></html>")


def test_rejects_pdf_with_javascript():
    with pytest.raises(HTTPException):
        f.validate_resume("cv.pdf", b"%PDF-1.7\n/OpenAction << /S /JavaScript /JS (app.alert(1)) >>")


def test_rejects_encrypted_pdf():
    with pytest.raises(HTTPException):
        f.validate_resume("cv.pdf", b"%PDF-1.7\n/Encrypt 5 0 R\n")


def test_rejects_docx_with_macros():
    with pytest.raises(HTTPException):
        f.validate_resume("cv.docx", _docx({"word/vbaProject.bin": "macro"}))


def test_rejects_legacy_ole_doc():
    with pytest.raises(HTTPException):
        f.validate_resume("cv.doc", b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1 old word doc")


def test_rejects_unknown_type():
    with pytest.raises(HTTPException):
        f.validate_resume("cv.bin", b"\x00\x01\x02 random bytes")


def test_rejects_oversize_pdf(monkeypatch):
    monkeypatch.setattr(f, "MAX_PDF_DOCX_BYTES", 16)
    with pytest.raises(HTTPException):
        f.validate_resume("cv.pdf", b"%PDF-1.7\n" + b"x" * 100)
