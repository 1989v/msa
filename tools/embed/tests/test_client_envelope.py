"""`ApiResponse` 봉투 벗기기와 재시도 규칙. 4xx 를 다시 보내면 같은 실패를 네 번 한다."""
from __future__ import annotations

import pytest
import requests

from embed import client


class _Resp:
    def __init__(self, status: int, payload=None, text: str | None = None):
        self.status_code = status
        self._payload = payload
        self.text = text if text is not None else ("{}" if payload is None else "…")

    def json(self):
        if self._payload is None:
            raise ValueError("not json")
        return self._payload


class _FakeSession:
    def __init__(self, responses):
        self.responses = list(responses)
        self.calls = []

    def request(self, method, url, **kw):
        self.calls.append((method, url))
        r = self.responses.pop(0)
        if isinstance(r, Exception):
            raise r
        return r


def _client(responses):
    c = client.InternalClient("http://localhost:9999", tries=3)
    c._session = _FakeSession(responses)
    return c


def test_unwraps_data_field():
    c = _client([_Resp(200, {"success": True, "data": {"inserted": 3}})])
    assert c.request("PUT", "/x") == {"inserted": 3}


def test_success_false_raises_with_code():
    c = _client([_Resp(200, {"success": False, "error": {"code": "INVALID", "message": "차원이 다릅니다"}})])
    with pytest.raises(client.InternalApiError, match="INVALID"):
        c.request("PUT", "/x")


def test_4xx_is_not_retried():
    c = _client([_Resp(400, None, text='{"success":false}')])
    with pytest.raises(client.InternalApiError) as e:
        c.request("PUT", "/x")
    assert e.value.status == 400
    assert len(c._session.calls) == 1


def test_5xx_is_retried_then_succeeds(monkeypatch):
    monkeypatch.setattr(client.time, "sleep", lambda *_: None)
    c = _client([_Resp(503, None, text="upstream"), _Resp(200, {"success": True, "data": 7})])
    assert c.request("GET", "/x") == 7
    assert len(c._session.calls) == 2


def test_connection_error_is_retried(monkeypatch):
    """터널은 끊긴다. 끊긴 것과 거부된 것을 같이 다루면 첫 끊김에 배치가 죽는다."""
    monkeypatch.setattr(client.time, "sleep", lambda *_: None)
    c = _client([requests.ConnectionError("보내기 실패"), _Resp(200, {"success": True, "data": "ok"})])
    assert c.request("GET", "/x") == "ok"


def test_empty_200_is_retried(monkeypatch):
    monkeypatch.setattr(client.time, "sleep", lambda *_: None)
    c = _client([_Resp(200, None, text="   "), _Resp(200, {"success": True, "data": 1})])
    assert c.request("GET", "/x") == 1


def test_batch_cap_matches_server():
    assert client.MAX_BATCH == 500
    api = client.PlaceEmbeddingClient("http://localhost:9999")
    with pytest.raises(ValueError, match="500건까지"):
        api.bulk("m@1234567#d4", 4, [{"attractionId": i} for i in range(501)])
    with pytest.raises(ValueError, match="500건까지"):
        api.lookup("m@1234567#d4", list(range(501)))


def test_empty_payloads_short_circuit_without_a_request():
    api = client.PlaceEmbeddingClient("http://localhost:9999")
    api._session = _FakeSession([])
    assert api.bulk("m@1234567#d4", 4, []) == {"inserted": 0, "updated": 0, "touched": 0}
    assert api.lookup("m@1234567#d4", [])["items"] == []
    assert api._session.calls == []
