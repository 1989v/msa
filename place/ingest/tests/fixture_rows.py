"""운영 표본(2026-10-02 첫 호출, 키·휴대전화 번호 제거) 로더. 원본은 스펙 implementation/sample-*.json 이다."""
from __future__ import annotations

import json
from pathlib import Path

FIXTURES = Path(__file__).resolve().parent / "fixtures"


def load(name: str) -> dict:
    return json.loads((FIXTURES / name).read_text(encoding="utf-8"))


def rows(name: str, key: str) -> list[dict]:
    return [dict(r) for r in load(name)[key]]


def all_rows(service: str) -> list[dict]:
    """한 서비스(KorService2 · EngService2)의 표본 행 전량 — 파일 이름 순, 묶음 순."""
    out: list[dict] = []
    for path in sorted(FIXTURES.glob("sample-*.json")):
        data = json.loads(path.read_text(encoding="utf-8"))
        if data["_meta"]["service"] != service:
            continue
        for key, value in data.items():
            if key != "_meta":
                out += [dict(r) for r in value]
    return out
