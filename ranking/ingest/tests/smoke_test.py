#!/usr/bin/env python3
"""ranking-ingest 스모크 — 가짜 랭킹 API 로 수집 경로를 끝까지 태운다. 의존 없음(표준 라이브러리).

    cd ranking/ingest && python3 -m tests.smoke_test

CI 게이트가 아니라 **배포 전 수동 확인**이다. 여기서 잡으려는 것은 둘이다:
  1. 유종별로 나눠 온 줄이 주유소 단위로 합쳐지는가 — 안 합치면 적재가 전체 동기화라
     뒤에 보낸 유종이 앞 유종의 가격 행을 지운다.
  2. KATEC 좌표가 WGS84 로 바뀌어 나가는가 — 안 바뀌면 지도 핀이 전부 어긋난다.
"""
from __future__ import annotations

import json
import os
import sys
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

PORT = int(os.environ.get("SMOKE_PORT", "18101"))
RECEIVED: list[dict] = []


class Handler(BaseHTTPRequestHandler):
    def do_POST(self):  # noqa: N802 - BaseHTTPRequestHandler 규약
        length = int(self.headers.get("Content-Length", "0"))
        body = json.loads(self.rfile.read(length).decode())
        if self.path.endswith("/stations/bulk"):
            RECEIVED.extend(body["stations"])
            payload = {"success": True, "data": {"received": len(body["stations"]),
                                                 "created": len(body["stations"]), "updated": 0}}
        else:
            payload = {"success": True, "data": {"boards": 4, "entries": 6}}
        data = json.dumps(payload).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def log_message(self, *args):  # 조용히
        pass


def main() -> int:
    os.environ["RANKING_API"] = f"http://127.0.0.1:{PORT}"
    server = HTTPServer(("127.0.0.1", PORT), Handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()

    from src import main as ingest  # RANKING_API 를 세운 뒤 임포트

    sample = Path(__file__).resolve().parent.parent / "src" / "stations.sample.jsonl"
    rc = ingest.main(["--job=gas-stations", f"--file={sample}"])
    server.shutdown()

    failures = []
    if rc != 0:
        failures.append(f"종료코드 {rc}")

    by_id = {s["opinetId"]: s for s in RECEIVED}
    if len(by_id) != len(RECEIVED):
        failures.append("주유소가 중복 전송됐다 — 유종 병합이 안 됐다")

    merged = by_id.get("A0019329")
    if not merged or {p["productCode"] for p in merged["prices"]} != {"B027", "D047"}:
        failures.append("유종별 두 줄이 한 주유소로 합쳐지지 않았다")
    if merged and merged.get("roadAddress") is None:
        failures.append("병합이 앞 줄의 주소를 잃었다")

    for station in RECEIVED:
        lat, lng = station.get("latitude"), station.get("longitude")
        if lat is None or lng is None:
            failures.append(f"{station['opinetId']} 좌표 변환 누락")
        elif not (33.0 <= lat <= 39.0 and 124.0 <= lng <= 132.0):
            failures.append(f"{station['opinetId']} 좌표가 한반도 밖 ({lat},{lng})")
        if station.get("katecX") is None:
            failures.append(f"{station['opinetId']} 원천 KATEC 이 버려졌다")

    if failures:
        for f in failures:
            print(f"  FAIL {f}")
        return 1
    print(f"  OK 주유소 {len(RECEIVED)}건 · 유종 병합 · 좌표 변환 확인")
    return 0


if __name__ == "__main__":
    sys.exit(main())
