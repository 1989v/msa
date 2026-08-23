#!/usr/bin/env python3
"""ranking-ingest 엔트리포인트 (ADR-0081).

K8s CronJob 이 --job 으로 분기해 호출한다:
    python -m src.main --job=gas-stations          # 오피넷 전량 수집 → 적재
    python -m src.main --job=gas-stations --file src/stations.sample.jsonl   # 키 없이 E2E
    python -m src.main --job=gas-boards            # 적재분으로 보드 스냅샷 생성

외부 :443 을 부르는 것은 이 CronJob 파드뿐이다 — 상시 파드(code-dictionary)에는 egress 를
열지 않는다.

수집과 서빙이 분리돼 있다는 것이 이 잡의 존재 이유다. 사용자 요청이 오피넷을 부르면
인기가 생기는 순간 일일 한도가 터지고, 오피넷 갱신은 어차피 일 단위라 실시간으로 부를
이유도 없다.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

from src import katec, opinet, ranking_client

SOURCE_LABEL = "한국석유공사 오피넷"


def log(message: str) -> None:
    print(f"[RANKING] {message}", flush=True)


def _api_key() -> str:
    # 참가격·식약처·TourAPI 와 **같은 포털 키**다. 별도 키를 만들지 않는다.
    key = os.environ.get("DATA_GO_KR_KEY")
    if not key:
        raise SystemExit("DATA_GO_KR_KEY 가 필요합니다 (--file 로 샘플 실행은 키 없이 가능)")
    return key


def _apply_coordinates(station: dict) -> dict:
    """지도에 찍을 WGS84 를 채운다. KATEC 원본은 그대로 남긴다 (data-sources.md §0 ①②).

    오퍼레이션마다 좌표를 주는 형태가 다르다 — 위경도로 오는 것도 있고 KATEC 으로 오는 것도
    있다. **이미 위경도면 변환하지 않는다.** 변환된 값을 또 변환하면 한반도 밖으로 날아간다.
    """
    lat, lng = station.get("latitude"), station.get("longitude")
    if lat is not None and lng is not None:
        if katec.within_korea(lat, lng):
            return station
        log(f"위경도 범위 밖 — {station.get('opinetId')} ({lat},{lng}) — 좌표를 비운다")
        station["latitude"] = station["longitude"] = None

    x, y = station.get("katecX"), station.get("katecY")
    if x is None or y is None:
        return station
    lat, lng = katec.katec_to_wgs84(x, y)
    if not katec.within_korea(lat, lng):
        # 좌표계가 다르거나 x/y 가 뒤바뀐 것 — 조용히 엉뚱한 핀을 찍느니 좌표를 비운다
        log(f"좌표 범위 밖 — {station.get('opinetId')} ({x},{y}) → ({lat:.4f},{lng:.4f})")
        return station
    station["latitude"] = round(lat, 7)
    station["longitude"] = round(lng, 7)
    return station


def _merge_by_station(rows: list[dict]) -> list[dict]:
    """유종별로 따로 받은 줄을 주유소 단위로 합친다.

    적재는 전체 동기화라 유종을 나눠 보내면 **뒤에 보낸 유종이 앞 유종의 가격 행을 지운다.**
    """
    merged: dict[str, dict] = {}
    for row in rows:
        key = row["opinetId"]
        current = merged.get(key)
        if current is None:
            merged[key] = dict(row)
            continue
        seen = {p["productCode"] for p in current["prices"]}
        current["prices"].extend(p for p in row["prices"] if p["productCode"] not in seen)
        # 유종별 응답이 서로 다른 필드를 채워 오는 경우가 있어 빈 값만 메운다
        for field, value in row.items():
            if field != "prices" and current.get(field) in (None, "", False) and value not in (None, ""):
                current[field] = value
    return list(merged.values())


def _collect_from_api(key: str) -> list[dict]:
    """시군구 × 유종의 최저가 상위 20곳을 모은다.

    포털에는 지역 단위 **전량**+가격 오퍼레이션이 없다 — 가격을 주는 지역 단위 경로는
    최저가 TOP20 뿐이다(오피넷 직접 신청에만 전량이 있다). "최저가 랭킹"이 목적이라
    데이터셋이 목적과 겹치지만, **전국 모든 주유소를 아는 것은 아니다** — 화면 문구가
    그 사실을 감추면 안 된다.
    """
    areas = [a for a in opinet.fetch_areas(key) if a["level"] == "SIGUN"]
    log(f"지역 {len(areas)}곳 × 유종 {len(opinet.PRODUCTS)}종 = {len(areas) * len(opinet.PRODUCTS)}콜")

    rows: list[dict] = []
    for area in areas:
        for product in opinet.PRODUCTS:
            rows.extend(opinet.fetch_area_top(key, area, product))
    return rows


def _collect_from_file(path: Path) -> list[dict]:
    rows = [json.loads(line) for line in path.read_text().splitlines() if line.strip()]
    log(f"샘플 {len(rows)}건 — 키 없이 적재 경로만 태운다")
    return rows


def job_gas_stations(sample: Path | None) -> int:
    try:
        rows = _collect_from_file(sample) if sample else _collect_from_api(_api_key())
    except opinet.QuotaExceeded as e:
        # 부분 적재를 남기지 않는다 — 적재가 전체 동기화라 다음 실행이 나머지를 지운다
        log(f"한도 초과로 중단, 적재하지 않는다: {e}")
        return 0
    except opinet.ApiNotConfigured as e:
        # 키·엔드포인트 미설정은 실패가 아니라 "아직 안 켬" 이다 — 실패 잡을 쌓지 않는다
        log(f"아직 설정되지 않아 건너뛴다: {e}")
        return 0

    stations = [_apply_coordinates(row) for row in _merge_by_station(rows)]
    with_coords = sum(1 for s in stations if s.get("latitude") is not None)
    created, updated = ranking_client.bulk_upsert_stations(stations)
    log(f"주유소 {len(stations):,}건 적재 (신규 {created} · 갱신 {updated} · 좌표 {with_coords:,})")
    return 0


def job_gas_boards() -> int:
    result = ranking_client.rebuild_boards(SOURCE_LABEL)
    log(f"보드 {result.get('boards', 0)}개 · 엔트리 {result.get('entries', 0)}건 스냅샷 생성")
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="ranking-ingest")
    parser.add_argument("--job", required=True, choices=["gas-stations", "gas-boards"])
    parser.add_argument("--file", type=Path, help="오피넷 대신 JSONL 샘플로 적재 (키 불요)")
    args = parser.parse_args(argv)

    if args.job == "gas-stations":
        return job_gas_stations(args.file)
    return job_gas_boards()


if __name__ == "__main__":
    sys.exit(main())
