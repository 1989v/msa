#!/usr/bin/env python3
"""2단계 공공데이터 — 원천 응답 키가 적재 레코드에 전부 남는지 판정한다 (data-sources.md §0 ①).

판정 근거는 **수집기 자신이 만든 레코드**다. 표본(`implementation/sample-phase2-apis.json`)의 행을 수집기의
레코드 함수(place-ingest `src/*.py`)에 넣고, 나온 레코드에서 원천 키·값을 되찾는다:
  - 레코드 값 중 JSON 객체 문자열(원문 컬럼)을 풀어 같은 키·같은 값이 있으면 남은 것이다
    (원문이 행 배열이면 — 단기예보는 격자 하나의 행 전부를 한 컬럼에 담는다 — 배열 안의 객체를 본다)
  - 레코드에 같은 이름·같은 값으로 편 키도 남은 것이다
표본의 키 집합(`keys`) 중 되찾지 못한 키가 있으면 그 API 는 실패다 — 정규 컬럼만 골라 싣는 레코드 함수가 여기서 걸린다.

적재 경로가 아직 없는 API 는 「미구현」으로 따로 적고 판정하지 않는다. 안 하기로 한 API(관광사진·반려동물)는 건너뛴다.

    python3 scripts/check_sample_fields.py               # 판정 (실패 시 exit 1)
    python3 scripts/check_sample_fields.py --self-test   # 정규 컬럼만 고르는 가짜 레코드 함수에 빨간불이 켜지는지까지
"""
from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime
from pathlib import Path
from typing import Callable

REPO = Path(__file__).resolve().parents[1]
SAMPLE = REPO / "docs/specs/2026-10-02-place-tour-portal-expansion/implementation/sample-phase2-apis.json"
sys.path.insert(0, str(REPO / "place" / "ingest"))

from src import barrier_free, congestion, name_match, related, visitors, weather, wellness  # noqa: E402

Recorder = Callable[[dict], dict]

#: 표본 이름 → 그 API 를 적재하는 수집기의 레코드 함수.
REGISTRY: dict[str, Recorder] = {
    "1 무장애 목록": barrier_free.list_record,
    "1 무장애 상세": lambda row: barrier_free.detail_record(str(row["contentid"]), row),
    "2 집중률": lambda row: congestion.record([row], name_match.Match(None, "NONE", ())),
    "3 연관 202608": lambda row: related.record([row], name_match.Match(None, "NONE", ()), [name_match.Match(None, "NONE", ())]),
    "7 웰니스": wellness.record,
    "8 기초 20260901": lambda row: visitors.record("SIGUNGU", row),
    "8 기초 20260801": lambda row: visitors.record("SIGUNGU", row),
    "8 광역 20260901": lambda row: visitors.record("SIDO", row),
    "8 광역 20260801": lambda row: visitors.record("SIDO", row),
    "10 단기예보": lambda row: weather.short_record([row]),
    "11 중기 육상": lambda row: weather.mid_record("LAND", datetime(2026, 10, 2, 6), row),
    "11 중기 기온": lambda row: weather.mid_record("TA", datetime(2026, 10, 2, 6), row),
}

#: 안 하기로 한 API — 대장에도 넣지 않는다 (phase2-design §0).
NOT_ADOPTED = {"6 관광사진", "9 반려동물 목록"}


def recovered_keys(row: dict, record: dict) -> set[str]:
    found: set[str] = set()
    for name, value in record.items():
        if name in row and value == row[name]:
            found.add(name)
        if isinstance(value, str) and value.lstrip().startswith(("{", "[")):
            try:
                raw = json.loads(value)
            except json.JSONDecodeError:
                continue
            for obj in (raw if isinstance(raw, list) else [raw]):
                if isinstance(obj, dict):
                    found |= {k for k, v in obj.items() if k in row and v == row[k]}
    return found


def check(sample: dict, registry: dict[str, Recorder]) -> tuple[dict[str, list[str]], list[str]]:
    """(API → 빠진 키, 미구현 API)."""
    missing: dict[str, list[str]] = {}
    pending: list[str] = []
    for name, entry in sample.items():
        if name in NOT_ADOPTED:
            continue
        recorder = registry.get(name)
        if recorder is None:
            pending.append(name)
            continue
        rows = entry.get("sample") or []
        if not rows:
            missing[name] = ["(표본 행 없음)"]
            continue
        lost: set[str] = set()
        for row in rows:
            lost |= set(row) - recovered_keys(row, recorder(row))
        # 표본이 기록한 키 집합 중 표본 행에 하나도 없는 키는 레코드로 확인할 수 없다 — 그것도 실패로 친다
        lost |= set(entry.get("keys") or []) - set().union(*rows)
        if lost:
            missing[name] = sorted(lost)
    return missing, pending


def report(missing: dict[str, list[str]], pending: list[str], registry: dict[str, Recorder]) -> None:
    for name in registry:
        print(f"{'FAIL' if name in missing else 'ok  '} {name}" + (f" — 빠진 키: {', '.join(missing[name])}" if name in missing else ""))
    if pending:
        print(f"미구현(적재 경로 없음, 판정 안 함): {', '.join(pending)}")


def self_test(sample: dict) -> bool:
    """정규 컬럼만 고르는 레코드 함수(원문을 버린다)를 넣으면 빠진 키 목록으로 실패해야 한다."""
    column_only: dict[str, Recorder] = {
        "1 무장애 목록": lambda row: {"contentId": row["contentid"], "listModifiedAt": row.get("modifiedtime")},
        "7 웰니스": lambda row: {"contentId": row["contentId"], "themaCd": row.get("wellnessThemaCd")},
        "10 단기예보": lambda row: {"nx": row["nx"], "ny": row["ny"], "baseDate": row["baseDate"]},
        "2 집중률": lambda row: {"tAtsNm": row["tAtsNm"], "signguCd": row["signguCd"], "areaCd": row["areaCd"]},
        "3 연관 202608": lambda row: {"tAtsCd": row["tAtsCd"], "tAtsNm": row["tAtsNm"], "signguCd": row["signguCd"]},
    }
    missing, _ = check(sample, column_only)
    caught = (set(missing) == set(column_only) and "title" in missing["1 무장애 목록"] and "mapX" in missing["7 웰니스"]
              and "fcstValue" in missing["10 단기예보"] and "cnctrRate" in missing["2 집중률"]
              and "rlteRank" in missing["3 연관 202608"])
    print(f"self-test: 원문을 버리는 레코드 함수 → {'빨간불(정상)' if caught else '초록불 — 판정이 아무것도 안 잰다'}")
    return caught


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--sample", type=Path, default=SAMPLE)
    ap.add_argument("--self-test", action="store_true")
    args = ap.parse_args()
    sample = json.loads(args.sample.read_text(encoding="utf-8"))
    missing, pending = check(sample, REGISTRY)
    report(missing, pending, REGISTRY)
    ok = not missing
    if args.self_test:
        ok = self_test(sample) and ok
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
