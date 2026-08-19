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

    print("SMOKE OK — 제외목록 적용 · 429 는 negative cache 제외 · 전체 레코드 적재 · 영상 매칭 필터")
    return 0


def _youtube_matcher() -> None:
    """관광지명이 제목·설명에 없는 영상은 버린다 — "경복궁" 검색에 무관한 영상이 섞여 온다."""
    from src import youtube

    assert youtube._matches("경복궁", {"title": "서울 경복궁 브이로그", "description": ""})
    assert youtube._matches("Gyeongbokgung Palace",
                            {"title": "Seoul walk", "description": "we visit Gyeongbokgung Palace"})
    assert not youtube._matches("경복궁", {"title": "부산 맛집 투어", "description": "해운대"})
    # 공백·문장부호는 무시하고 붙여서 본다
    assert youtube._matches("전주 한옥마을", {"title": "전주한옥마을 1박2일", "description": ""})
    # 이름이 통째로 사라지는 입력은 매칭하지 않는다 (아무 영상이나 붙는 것을 막는다)
    assert not youtube._matches("!!!", {"title": "무엇이든", "description": ""})


if __name__ == "__main__":
    sys.exit(main())
