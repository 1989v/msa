"""place SSOT 클라이언트 (ADR-0070).

클러스터 안에서는 `http://place:8096` 을 직접 부른다 — 게이트웨이를 거치지 않으므로
쓰기(ADMIN 게이트)를 위해 토큰을 발급할 필요가 없다. 로컬 실행은 `PLACE_API` 로 덮어쓴다.
"""
from __future__ import annotations

import json
import os
import urllib.parse
import urllib.request

BASE = os.environ.get("PLACE_API", "http://place:8096").rstrip("/")
PAGE_SIZE = 1000
BULK_CHUNK = 2000          # place 가 요청당 2000건으로 제한한다

# 엣지(Cloudflare)가 기본 urllib UA 를 403 으로 막는다 — 로컬에서 프록시를 거칠 때만 필요하지만
# 클러스터 직결에서도 무해하므로 한 값으로 둔다.
_UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
       "(KHTML, like Gecko) Chrome/140.0 Safari/537.36")


def _request(method: str, path: str, body: dict | None = None, timeout: int = 120) -> dict:
    data = json.dumps(body, ensure_ascii=False).encode() if body is not None else None
    req = urllib.request.Request(
        f"{BASE}{path}",
        data=data,
        method=method,
        headers={"Accept": "application/json", "User-Agent": _UA,
                 **({"Content-Type": "application/json"} if data else {})},
    )
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode())


def fetch_attractions() -> list[dict]:
    """전량 페이지 스캔. 재색인 배치와 같은 경로를 쓴다."""
    rows: list[dict] = []
    page = 0
    while True:
        qs = urllib.parse.urlencode({"page": page, "size": PAGE_SIZE})
        data = _request("GET", f"/api/places/attractions?{qs}")["data"]
        got = data.get("attractions") or []
        rows.extend(got)
        if not got or len(rows) >= int(data.get("totalElements") or 0):
            break
        page += 1
    return rows


def bulk_upsert(records: list[dict]) -> tuple[int, int]:
    """전체 동기화다 — 부분 레코드를 보내면 나머지 필드가 null 로 덮인다 (개요만 예외)."""
    created = updated = 0
    for i in range(0, len(records), BULK_CHUNK):
        chunk = records[i:i + BULK_CHUNK]
        data = _request("POST", "/api/places/attractions/bulk",
                        {"attractions": chunk}, timeout=600)["data"]
        created += int(data.get("created") or 0)
        updated += int(data.get("updated") or 0)
    return created, updated


def fetch_probe_keys(lang: str | None = None) -> set[str]:
    """개요 negative cache — `lang:contentId` 집합."""
    qs = f"?{urllib.parse.urlencode({'lang': lang})}" if lang else ""
    return set(_request("GET", f"/api/places/attractions/overview-probes{qs}")["data"]["keys"])


def record_probes(items: list[dict]) -> int:
    """원천이 빈 개요를 준 레코드만 넣는다. **429·네트워크 실패는 넣지 않는다.**"""
    if not items:
        return 0
    recorded = 0
    for i in range(0, len(items), BULK_CHUNK):
        chunk = items[i:i + BULK_CHUNK]
        recorded += int(_request("POST", "/api/places/attractions/overview-probes",
                                 {"probes": chunk})["data"]["recorded"])
    return recorded


def fetch_pending_links(source: str, limit: int) -> list[dict]:
    """수집 대상. **빈 목록은 실패가 아니라 "오늘 몫을 다 썼다"** 는 뜻이다 — 예산은 place 가 센다."""
    qs = urllib.parse.urlencode({"source": source, "limit": limit})
    return _request("GET", f"/internal/attractions/links/pending?{qs}")["data"]["items"]


def apply_link_results(source: str, results: list[dict]) -> dict:
    """`failed: true` 와 `links: []` 는 다른 뜻이다 — 전자는 답을 못 받은 것, 후자는 0건이라는 답이다."""
    if not results:
        return {"collected": 0, "empty": 0, "failed": 0}
    return _request("POST", "/internal/attractions/links/bulk",
                    {"source": source, "results": results}, timeout=300)["data"]
