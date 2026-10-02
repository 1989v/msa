"""place SSOT 클라이언트 (ADR-0070).

클러스터 안에서는 `http://place:8096` 을 직접 부른다 — 게이트웨이를 거치지 않으므로
쓰기(ADMIN 게이트)를 위해 토큰을 발급할 필요가 없다. 로컬 실행은 `PLACE_API` 로 덮어쓴다.
"""
from __future__ import annotations

import json
import os
import time
import urllib.parse
import urllib.request

BASE = os.environ.get("PLACE_API", "http://place:8096").rstrip("/")
PAGE_SIZE = 200           # place 가 목록 size 를 200 으로 자른다 — 더 크게 보내도 200건씩 온다
BULK_CHUNK = 2000          # place 가 요청당 2000건으로 제한한다

# 엣지(Cloudflare)가 기본 urllib UA 를 403 으로 막는다 — 로컬에서 프록시를 거칠 때만 필요하지만
# 클러스터 직결에서도 무해하므로 한 값으로 둔다.
_UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
       "(KHTML, like Gecko) Chrome/140.0 Safari/537.36")


# 연결 자체가 안 되는 오류만 재시도한다 (HTTP 4xx/5xx 는 서버의 답이므로 그대로 올린다).
#
# 왜 필요한가: k3s 의 NetworkPolicy 컨트롤러는 **새 파드의 IP 를 허용 목록에 등록하는 데
# 수 초~수십 초가 걸린다.** 파이썬 잡은 뜨자마자 1초 안에 place 를 부르므로 그 창에서
# REJECT(= Connection refused)를 맞는다 — 같은 파드가 25초 뒤엔 성공하는 것을 실측했다
# (2026-08-21). Spring 배치(재색인)가 무사했던 건 부팅 40초가 우연히 이 창을 넘겨서다.
_CONNECT_RETRIES = (2, 4, 8, 16, 30)


def _request(method: str, path: str, body: dict | None = None, timeout: int = 120) -> dict:
    data = json.dumps(body, ensure_ascii=False).encode() if body is not None else None
    req = urllib.request.Request(
        f"{BASE}{path}",
        data=data,
        method=method,
        headers={"Accept": "application/json", "User-Agent": _UA,
                 **({"Content-Type": "application/json"} if data else {})},
    )
    for attempt, wait in enumerate((*_CONNECT_RETRIES, None)):
        try:
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return json.loads(r.read().decode())
        except urllib.error.HTTPError as e:
            # 서버가 답한 것 — 재시도 대상이 아니다. **본문을 붙여서** 올린다:
            # 그냥 raise 하면 로그에 "HTTP Error 500:" 만 남아 무엇이 잘못됐는지 알 수 없다.
            detail = ""
            try:
                detail = e.read().decode(errors="replace")[:500]
            except Exception:
                pass
            raise RuntimeError(f"[place] {method} {path} → HTTP {e.code}: {detail}") from e
        except (urllib.error.URLError, TimeoutError, ConnectionError) as e:
            if wait is None:
                raise
            print(f"[place] 연결 실패(시도 {attempt + 1}): {e} — {wait}s 후 재시도", flush=True)
            time.sleep(wait)
    raise AssertionError("unreachable")


def fetch_attractions() -> list[dict]:
    """전량 스캔 — id 키셋(`afterId`)으로 id 오름차순. 재색인 배치와 같은 경로를 쓴다.

    OFFSET 페이지는 건너뛸 행을 전부 읽어 뒤로 갈수록 느려졌다(6만 건 끝에서 4.9초, 키셋 0.3초).
    키셋 응답은 전체 건수를 모르므로(-1) 끝은 `nextAfterId` 가 없거나 빈 페이지로만 판정한다.
    """
    rows: list[dict] = []
    after_id = 0
    while True:
        qs = urllib.parse.urlencode({"afterId": after_id, "size": PAGE_SIZE})
        data = _request("GET", f"/api/places/attractions?{qs}")["data"]
        got = data.get("attractions") or []
        # 이미 받은 id 가 다시 오면 커서가 앞으로 가지 않는 것이다 — 무한히 되읽기 전에 멈춘다.
        last_id = int(rows[-1]["id"]) if rows else 0
        if got and int(got[0]["id"]) <= last_id:
            raise RuntimeError(f"[place] 키셋이 앞으로 가지 않는다: afterId={after_id}, 첫 id={got[0]['id']}")
        rows.extend(got)
        next_after = data.get("nextAfterId")
        if not got or next_after is None:
            break
        after_id = int(next_after)
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


def put_barrier_free_list(records: list[dict]) -> dict:
    """무장애 목록 행 — contentId(국문)로 관광지에 붙여 upsert. 상세 값은 건드리지 않는다.
    반환: matched · unmatched 합계와 못 붙은 contentId 표본."""
    total = {"matched": 0, "unmatched": 0, "unmatchedSample": []}
    for i in range(0, len(records), BULK_CHUNK):
        data = _request("PUT", "/internal/attractions/barrier-free/list",
                        {"items": records[i:i + BULK_CHUNK]}, timeout=300)["data"]
        total["matched"] += int(data.get("matched") or 0)
        total["unmatched"] += int(data.get("unmatched") or 0)
        total["unmatchedSample"] += list(data.get("unmatchedSample") or [])
    total["unmatchedSample"] = total["unmatchedSample"][:20]
    return total


def fetch_barrier_free_state() -> list[dict]:
    """상세 대상 선택에 쓰는 행 상태 — contentId · listModifiedAt · detailSyncedAt (약 1만 행, 원문 없음)."""
    return _request("GET", "/internal/attractions/barrier-free/state")["data"]["items"]


def put_barrier_free_details(records: list[dict]) -> int:
    """상세 원문 + 파생 플래그. 관광지에 붙지 않은 contentId 는 서버가 건너뛴다."""
    applied = 0
    for i in range(0, len(records), BULK_CHUNK):
        applied += int(_request("PUT", "/internal/attractions/barrier-free/details",
                                {"items": records[i:i + BULK_CHUNK]}, timeout=300)["data"]["applied"])
    return applied


def put_wellness(lang: str, items: list[dict]) -> dict:
    """웰니스 태그 — 그 언어의 목록을 통째로 바꾼다(요청에 없는 그 언어의 태그는 지운다)."""
    return _request("PUT", "/internal/attractions/wellness", {"lang": lang, "items": items}, timeout=300)["data"]


def put_region_visitors(records: list[dict]) -> dict:
    """지역 방문자 일자 행 — (수준, 지역, 날짜, 구분) 키로 upsert. place 가 받은 지역의 허브 캐시를 다시 채운다."""
    total = {"applied": 0, "regions": 0}
    for i in range(0, len(records), BULK_CHUNK):
        data = _request("PUT", "/internal/regions/visitors", {"items": records[i:i + BULK_CHUNK]}, timeout=300)["data"]
        total["applied"] += int(data.get("applied") or 0)
        total["regions"] += int(data.get("regions") or 0)
    return total


def upsert_category_codes(rows: list[dict]) -> int:
    """분류체계 코드표 — (lang, code) 멱등 upsert. 표가 작아 한 번에 보낸다."""
    if not rows:
        return 0
    applied = 0
    for i in range(0, len(rows), BULK_CHUNK):
        chunk = rows[i:i + BULK_CHUNK]
        applied += int(_request("PUT", "/internal/attractions/category-codes",
                                {"items": chunk})["data"]["applied"])
    return applied


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


def enqueue_links(attraction_ids: list[int]) -> int:
    """수집 대상을 큐에 올린다 (ADR-0095).

    예전에는 사용자가 상세를 열 때 올라갔다. 링크가 색인에서 서빙되면 그 호출이 사라지므로
    **인기 집계를 아는 수집기가 직접 올린다.**
    """
    if not attraction_ids:
        return 0
    return int(_request("POST", "/internal/attractions/links/enqueue",
                        {"attractionIds": attraction_ids})["data"]["enqueued"])


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


def fetch_pending_google_place_ids(limit: int) -> list[dict]:
    """구글 place_id 미보강분 (id 순). 빈 목록 = 전부 채워졌다는 뜻이다."""
    qs = urllib.parse.urlencode({"limit": limit})
    return _request("GET", f"/internal/attractions/google-place-ids/pending?{qs}")["data"]["items"]


def apply_google_place_ids(results: list[dict]) -> int:
    """찾은 id 만 보낸다 — 검색 0건은 항목을 만들지 않는다 (null 로 남아 다음 실행이 재시도)."""
    if not results:
        return 0
    return int(_request("POST", "/internal/attractions/google-place-ids/bulk",
                        {"results": results}, timeout=300)["data"]["applied"])
