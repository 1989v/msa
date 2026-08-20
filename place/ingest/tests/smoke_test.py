#!/usr/bin/env python3
"""place-ingest 스모크 — 가짜 place API 로 수집 경로를 끝까지 태운다. 의존 없음(표준 라이브러리).

    cd place/ingest && python3 -m tests.smoke_test

CI 게이트가 아니라 **배포 전 수동 확인**이다. 여기서 잡으려는 것은 하나다:
원천이 빈 개요를 준 것(negative cache 대상)과 일시적 실패(429·네트워크)를 섞지 않는가.
섞으면 실패한 레코드가 영영 재시도되지 않고, 며칠치 수집이 조용히 사라진다.
"""
from __future__ import annotations

import json
import os
import sys
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer

PORT = int(os.environ.get("SMOKE_PORT", "18099"))

ROWS = [
    {"id": 1, "contentId": "126508", "lang": "ko", "title": "경복궁", "latitude": 37.5788,
     "longitude": 126.977, "category": "history", "imageUrl": "http://img/1", "overview": None},
    {"id": 2, "contentId": "264337", "lang": "en", "title": "Gyeongbokgung", "latitude": 37.5788,
     "longitude": 126.977, "category": "history", "imageUrl": None, "overview": None},
    {"id": 3, "contentId": "999", "lang": "ko", "title": "개요있음", "latitude": 35.1,
     "longitude": 129.0, "category": "food", "overview": "이미 있음"},
]
POSTED: dict[str, list] = {"bulk": [], "probes": []}


class FakePlace(BaseHTTPRequestHandler):
    def log_message(self, *args):  # 조용히
        pass

    def _send(self, payload: dict) -> None:
        body = json.dumps({"data": payload}).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path.startswith("/api/places/attractions/overview-probes"):
            self._send({"keys": ["ko:126508"], "total": 1})   # 경복궁은 원천 개요없음으로 제외
        elif self.path.startswith("/api/places/attractions?"):
            self._send({"attractions": ROWS, "totalElements": len(ROWS),
                        "totalPages": 1, "currentPage": 0})
        else:
            self.send_response(404)
            self.end_headers()

    def do_POST(self):
        body = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
        if self.path.endswith("/bulk"):
            POSTED["bulk"] += body["attractions"]
            self._send({"created": 0, "updated": len(body["attractions"]), "total": len(ROWS)})
        else:
            POSTED["probes"] += body["probes"]
            self._send({"recorded": len(body["probes"])})


def main() -> int:
    server = HTTPServer(("127.0.0.1", PORT), FakePlace)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    os.environ["PLACE_API"] = f"http://127.0.0.1:{PORT}"

    from src import backfill_overview as bo
    from src import place_client

    rows = place_client.fetch_attractions()
    assert len(rows) == len(ROWS), rows
    known = place_client.fetch_probe_keys()
    assert known == {"ko:126508"}, known

    # 제외 목록과 "이미 개요 있음"이 둘 다 걸러진다
    assert bo.pick(rows, "ko", 10, known) == [], "ko 는 전부 제외 대상이다"
    assert [r["contentId"] for r in bo.pick(rows, "en", 10, known)] == ["264337"]

    calls: list[str] = []

    def fake_tour_get(_key, _service, _op, params):
        calls.append(params["contentId"])
        if params["contentId"] == "A":
            return {"items": {"item": [{"overview": "  내용  "}]}}
        if params["contentId"] == "B":
            return {"items": {"item": [{"overview": ""}]}}   # 원천이 빈 값
        raise RuntimeError("429 Too Many Requests")           # 일시적 실패

    bo.tour_get = fake_tour_get
    targets = [
        {"contentId": "A", "lang": "ko", "title": "가", "latitude": 1.0, "longitude": 2.0,
         "category": "nature"},
        {"contentId": "B", "lang": "ko", "title": "나", "latitude": 1.0, "longitude": 2.0},
        {"contentId": "C", "lang": "ko", "title": "다", "latitude": 1.0, "longitude": 2.0},
    ]
    records, empty = bo.collect("key", targets)

    assert calls == ["A", "B", "C"], calls
    assert [r["contentId"] for r in records] == ["A"], records
    assert records[0]["overview"] == "내용", records[0]
    # 핵심: 429 인 C 는 negative cache 에 들어가지 않는다 (들어가면 영영 재시도 안 됨)
    assert [e["contentId"] for e in empty] == ["B"], empty

    place_client.bulk_upsert(records)
    place_client.record_probes(empty)
    assert len(POSTED["bulk"]) == 1 and POSTED["bulk"][0]["contentId"] == "A", POSTED["bulk"]
    assert POSTED["probes"] == [{"contentId": "B", "lang": "ko"}], POSTED["probes"]

    _youtube_matcher()
    _admin_region_parser()

    print("SMOKE OK — 제외목록 · 429 분리 · 전체 레코드 적재 · 매칭 필터 · 법정동 파서")
    return 0


def _youtube_matcher() -> None:
    """관광지명이 제목·설명에 없는 결과는 버린다 — "경복궁" 검색에 무관한 것이 섞여 온다.

    유튜브와 블로그가 **같은 판단**을 쓰는지도 여기서 본다. 소스마다 기준이 갈리면
    같은 관광지에 붙는 콘텐츠 품질이 소스마다 달라진다.
    """
    from src import naver
    from src.linkmatch import matches, normalize, strip_tags

    assert matches("경복궁", "서울 경복궁 브이로그", "")
    assert matches("Gyeongbokgung Palace", "Seoul walk", "we visit Gyeongbokgung Palace")
    assert not matches("경복궁", "부산 맛집 투어", "해운대")
    # 공백·문장부호는 무시하고 붙여서 본다
    assert matches("전주 한옥마을", "전주한옥마을 1박2일", "")
    # 이름이 통째로 사라지는 입력은 매칭하지 않는다 (아무거나 붙는 것을 막는다)
    assert not matches("!!!", "무엇이든", "")
    assert normalize("전주 한옥마을!") == "전주한옥마을"

    # 네이버는 매칭 구간을 <b> 로 감싸 준다 — 걷어내지 않으면 태그가 제목에 남는다
    assert strip_tags("<b>경복궁</b> 나들이") == "경복궁 나들이"
    assert naver._post_date("20260819") == "2026-08-19T00:00:00"
    assert naver._post_date("2026") is None


def _admin_region_parser() -> None:
    """법정동코드 자료에서 시도·시군구만 뽑는다 — 읍면동과 폐지 코드는 버린다."""
    from src.admin_region import parse

    rows = parse([
        "법정동코드\t법정동명\t폐지여부",
        "1100000000\t서울특별시\t존재",
        "1111000000\t서울특별시 종로구\t존재",
        "1111010100\t서울특별시 종로구 청운동\t존재",   # 읍면동 — 탐색 단위가 아니다
        "2600000000\t부산광역시\t폐지",                  # 폐지 코드
        "4100000000\t경기도\t존재",
        "4111000000\t경기도 수원시\t존재",
        "4111100000\t경기도 수원시 장안구\t존재",
    ])

    assert [r["code"] for r in rows] == ["11", "11110", "41", "41110", "41111"], rows
    # 상위를 이미 골랐으므로 시도 접두는 떼고 보인다
    assert rows[1]["name"] == "종로구"
    # 시(수원시)와 자치구(수원시 장안구)가 둘 다 5자리다 — 어느 쪽을 쓸지 여기서 정하지 않는다
    assert rows[3]["name"] == "수원시" and rows[4]["name"] == "수원시 장안구"
    assert all(r["parentCode"] == r["code"][:2] for r in rows if r["level"] == "SIGUNGU")


if __name__ == "__main__":
    sys.exit(main())
