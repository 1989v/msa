"""내부 API 클라이언트 (`/internal/**`) — place 임베딩 · search 질의 사전.

`/internal` 은 게이트웨이가 라우팅하지 않으므로(게이트웨이는 `/api`·`/sse`·`/ws`·`/actuator` 만 받는다)
`tunnel.sh` 가 뚫은 port-forward 로 닿는다. 인증이 없는 대신 클러스터 밖에서 못 닿는 것이 방어다.

재시도 규칙: **네트워크 오류·5xx·빈 200 만** 다시 보낸다. 4xx 는 요청이 틀린 것이라 다시 보내도 같다.
업서트는 요청 단위 all-or-nothing 이고 같은 내용이면 결과가 같아서(멱등) 재시도가 안전하다.
"""
from __future__ import annotations

import json
import time

import requests

#: 서버의 `AttractionEmbeddingInternalController.MAX_BATCH` 와 같은 값. 넘기면 400 이다.
MAX_BATCH = 500

_UA = {"User-Agent": "kgd-embed/0.1", "Accept": "application/json"}
_RETRY_STATUS = frozenset({429, 500, 502, 503, 504})


class InternalApiError(RuntimeError):
    """서버가 거부했다. `body` 에 원문을 그대로 담는다 — 어느 항목이 왜 걸렸는지가 거기 있다."""

    def __init__(self, message: str, *, status: int | None = None, body: str = ""):
        super().__init__(message)
        self.status = status
        self.body = body


class InternalClient:
    """`ApiResponse<T>` 봉투를 벗겨 `data` 만 돌려준다. `success: false` 면 예외."""

    def __init__(self, base_url: str, *, timeout: float = 120.0, tries: int = 4):
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout
        self.tries = tries
        self._session = requests.Session()

    def request(self, method: str, path: str, *, params: dict | None = None, body: dict | None = None):
        url = f"{self.base_url}{path}"
        last = ""
        for attempt in range(self.tries):
            try:
                r = self._session.request(method, url, params=params, json=body, headers=_UA, timeout=self.timeout)
            except requests.RequestException as e:  # 터널이 끊기면 여기로 온다 — 다시 열릴 수 있으니 재시도
                last = f"연결 실패: {e}"
            else:
                if r.status_code < 400 and r.text.strip():
                    return self._unwrap(r)
                if r.status_code < 400:
                    # 게이트웨이 밖이라 드물지만, 업스트림 재기동 중에는 빈 200 이 나온다
                    last = f"status={r.status_code} 인데 바디가 비었다"
                elif r.status_code in _RETRY_STATUS:
                    last = f"status={r.status_code} body={r.text[:400]!r}"
                else:
                    raise InternalApiError(
                        f"{method} {url} → {r.status_code}\n{r.text[:2000]}", status=r.status_code, body=r.text)
            if attempt < self.tries - 1:
                time.sleep(1.5 * (attempt + 1))
        raise InternalApiError(f"{method} {url}: {self.tries}회 실패 — {last}")

    @staticmethod
    def _unwrap(r: requests.Response):
        try:
            payload = r.json()
        except ValueError:
            raise InternalApiError(f"JSON 이 아니다: {r.text[:400]!r}", status=r.status_code, body=r.text) from None
        if not isinstance(payload, dict) or "success" not in payload:
            return payload  # ApiResponse 봉투가 아닌 응답(있다면)은 그대로
        if not payload.get("success"):
            err = payload.get("error") or {}
            raise InternalApiError(
                f"{err.get('code', '?')}: {err.get('message', '')}", status=r.status_code, body=json.dumps(payload, ensure_ascii=False))
        return payload.get("data")


class PlaceEmbeddingClient(InternalClient):
    """`/internal/attractions/embeddings` — 관광지 문서 벡터 (embedding-entities.md §2.5)."""

    PATH = "/internal/attractions/embeddings"

    def pending(self, model_ref: str, limit: int = MAX_BATCH) -> dict:
        return self.request("GET", f"{self.PATH}/pending", params={"modelRef": model_ref, "limit": limit})

    def bulk(self, model_ref: str, dim: int, items: list[dict]) -> dict:
        if not items:
            return {"inserted": 0, "updated": 0, "touched": 0}
        if len(items) > MAX_BATCH:
            raise ValueError(f"한 번에 {MAX_BATCH}건까지입니다: {len(items)}")
        return self.request("PUT", f"{self.PATH}/bulk", body={"modelRef": model_ref, "dim": dim, "items": items})

    def lookup(self, model_ref: str, ids: list[int]) -> dict:
        if not ids:
            return {"modelRef": model_ref, "items": []}
        if len(ids) > MAX_BATCH:
            raise ValueError(f"한 번에 {MAX_BATCH}건까지입니다: {len(ids)}")
        return self.request("POST", f"{self.PATH}/lookup", body={"modelRef": model_ref, "ids": [int(i) for i in ids]})

    def status(self, model_ref: str) -> dict:
        return self.request("GET", f"{self.PATH}/status", params={"modelRef": model_ref})

    def delete_model(self, model_ref: str) -> dict:
        return self.request("DELETE", self.PATH, params={"modelRef": model_ref})


class QueryVectorClient(InternalClient):
    """`/internal/query-vectors` — 질의 사전 (embedding-entities.md §3.4).

    이 엔드포인트는 **P1-4 에서 만든다.** 계약은 스펙에 고정돼 있어 도구를 먼저 써 두지만,
    붙기 전까지 `misses`·`bulk` 는 404 가 난다.
    """

    PATH = "/internal/query-vectors"

    def bulk(self, model_ref: str, dim: int, items: list[dict]) -> dict:
        if not items:
            return {"upserted": 0, "skippedEmpty": 0}
        if len(items) > MAX_BATCH:
            raise ValueError(f"한 번에 {MAX_BATCH}건까지입니다: {len(items)}")
        return self.request("PUT", f"{self.PATH}/bulk", body={"modelRef": model_ref, "dim": dim, "items": items})

    def misses(self, model_ref: str, limit: int = MAX_BATCH) -> list[dict]:
        return self.request("GET", f"{self.PATH}/misses", params={"modelRef": model_ref, "limit": limit}) or []

    def clear_misses(self, model_ref: str, normalized: list[str]) -> dict:
        if not normalized:
            return {"removed": 0}
        return self.request("DELETE", f"{self.PATH}/misses", body={"modelRef": model_ref, "normalized": normalized})

    def status(self, model_ref: str) -> dict:
        return self.request("GET", f"{self.PATH}/status", params={"modelRef": model_ref})
