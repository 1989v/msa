"""랭킹 서비스(code-dictionary 호스트) 적재 클라이언트 (ADR-0081).

클러스터 안에서는 `http://code-dictionary:8089` 를 직접 부른다 — 게이트웨이를 거치지 않으므로
쓰기를 위해 토큰을 발급할 필요가 없다. 로컬 실행은 `RANKING_API` 로 덮어쓴다.
"""
from __future__ import annotations

import json
import os
import time
import urllib.error
import urllib.request

BASE = os.environ.get("RANKING_API", "http://code-dictionary:8089").rstrip("/")
BULK_CHUNK = 500

# 연결 자체가 안 되는 오류만 재시도한다 (HTTP 4xx/5xx 는 서버의 답이므로 그대로 올린다).
# k3s NetworkPolicy 컨트롤러가 새 파드 IP 를 허용 목록에 올리는 데 수 초~수십 초가 걸려,
# 뜨자마자 부르는 파이썬 잡은 그 창에서 Connection refused 를 맞는다 (place/ingest 와 같은 함정).
_CONNECT_RETRIES = (2, 4, 8, 16, 30)


def _post(path: str, body: dict, timeout: int = 120) -> dict:
    data = json.dumps(body, ensure_ascii=False).encode()
    request = urllib.request.Request(
        f"{BASE}{path}",
        data=data,
        method="POST",
        headers={"Accept": "application/json", "Content-Type": "application/json"},
    )
    for wait in (*_CONNECT_RETRIES, None):
        try:
            with urllib.request.urlopen(request, timeout=timeout) as response:
                return json.loads(response.read().decode())
        except urllib.error.HTTPError:
            raise
        except (urllib.error.URLError, TimeoutError, ConnectionError):
            if wait is None:
                raise
            time.sleep(wait)
    raise RuntimeError("unreachable")


def bulk_upsert_stations(stations: list[dict]) -> tuple[int, int]:
    """주유소 적재. 반환은 (신규, 갱신)."""
    created = updated = 0
    for start in range(0, len(stations), BULK_CHUNK):
        chunk = stations[start:start + BULK_CHUNK]
        payload = _post("/internal/ranking/gas/stations/bulk", {"stations": chunk})
        data = payload.get("data") or {}
        created += int(data.get("created") or 0)
        updated += int(data.get("updated") or 0)
    return created, updated


def rebuild_boards(source_label: str) -> dict:
    """적재분으로 시군구 × 유종 보드 스냅샷을 다시 만든다."""
    payload = _post("/internal/ranking/gas/boards/rebuild", {"sourceLabel": source_label})
    return payload.get("data") or {}
